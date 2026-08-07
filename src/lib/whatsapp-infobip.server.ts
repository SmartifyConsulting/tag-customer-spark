// Server-only Infobip WhatsApp delivery adapter.
//
// Infobip is a pure delivery mechanism — no business logic lives here.
// Docs: https://www.infobip.com/docs/api/channels/whatsapp
//
// Required runtime env:
//   INFOBIP_API_KEY          — Infobip dashboard > Developers > API keys
//   INFOBIP_BASE_URL         — personal base URL, e.g. "xyz123.api.infobip.com"
//   INFOBIP_WHATSAPP_SENDER  — registered WhatsApp sender in E.164

export type InfobipSendInput = {
  to: string; // E.164, with or without "+" / "whatsapp:" prefix
  body?: string;
  mediaUrl?: string | null;
  /** Approved WhatsApp template name registered in Infobip. */
  templateName?: string;
  /** Language code of the approved template, e.g. "en" / "en_GB". */
  templateLanguage?: string;
  /** Ordered body placeholders for the approved template. */
  placeholders?: string[];
  /** Optional header image URL when the template has a media header. */
  headerImageUrl?: string | null;
};

export type InfobipSendResult = {
  ok: boolean;
  status: number;
  sid?: string;
  error?: string;
  diagnostic?: InfobipRuntimeDiagnostic;
};

export type InfobipRuntimeDiagnostic = {
  keyBinding: string;
  keyFingerprint: string;
  keyLength: number;
  normalizedAppPrefix: boolean;
  normalizedWrappingQuotes: boolean;
  normalizedWhitespace: boolean;
  apiHost: string;
  senderSuffix: string;
  responseRequestId?: string;
  /** Every distinct credential binding this runtime could see, in try order. */
  availableBindings?: string[];
  /** Bindings actually attempted before this result (auth retry evidence). */
  attemptedBindings?: string[];
};

type RuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  sender: string;
  diagnostic: InfobipRuntimeDiagnostic;
};

/** Candidate credential bindings, in preference order. */
const KEY_BINDINGS = ["INFOBIP_API_KEY_V2", "INFOBIP_API_KEY"] as const;


function normalizeNumber(num: string): string {
  const trimmed = num.trim();
  const stripped = trimmed.startsWith("whatsapp:")
    ? trimmed.slice("whatsapp:".length)
    : trimmed;
  // Infobip expects digits only (no leading "+").
  return stripped.replace(/[^\d]/g, "");
}

function unwrapQuotes(raw: string): { value: string; changed: boolean } {
  let value = raw.trim();
  let changed = false;
  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
    changed = true;
  }
  return { value, changed };
}

function normalizeBaseUrl(raw: string): string {
  const { value } = unwrapQuotes(raw);
  const withoutTrailingSlash = value.replace(/\/+$/, "");
  return /^https?:\/\//i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `https://${withoutTrailingSlash}`;
}

async function fingerprint(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resolves every distinct Infobip credential this runtime can see, in
 * preference order and de-duplicated by value.
 *
 * Different execution contexts (authenticated server functions vs the public
 * `/api/public/*` routes) can be handed different secret bindings. Silently
 * picking the first name present meant one path authenticated with a current
 * key and the other with a superseded one. We now enumerate them, record which
 * binding was used, and fall through to the next candidate on an auth
 * rejection instead of failing the customer's confirmation.
 */
async function readRuntimeConfigs(): Promise<RuntimeConfig[]> {
  // Read inside the request operation. Do not move these values to module
  // scope: bindings are injected per request in the deployed runtime.
  const rawBaseUrl = process.env.INFOBIP_BASE_URL;
  const rawSender = process.env.INFOBIP_WHATSAPP_SENDER;
  if (!rawBaseUrl || !rawSender) return [];

  const normalizedUrl = normalizeBaseUrl(rawBaseUrl);
  const sender = normalizeNumber(unwrapQuotes(rawSender).value);
  const apiHost = new URL(normalizedUrl).hostname;

  const configs: RuntimeConfig[] = [];
  const seen = new Set<string>();

  for (const binding of KEY_BINDINGS) {
    const raw = process.env[binding];
    if (!raw) continue;

    const unwrappedKey = unwrapQuotes(raw);
    const hadAppPrefix = /^(?:App\s+)+/i.test(unwrappedKey.value);
    const apiKey = unwrappedKey.value.replace(/^(?:App\s+)+/i, "").trim();
    if (!apiKey || seen.has(apiKey)) continue;
    seen.add(apiKey);

    configs.push({
      apiKey,
      baseUrl: normalizedUrl,
      sender,
      diagnostic: {
        keyBinding: binding,
        keyFingerprint: await fingerprint(apiKey),
        keyLength: apiKey.length,
        normalizedAppPrefix: hadAppPrefix,
        normalizedWrappingQuotes: unwrappedKey.changed,
        normalizedWhitespace: apiKey !== raw,
        apiHost,
        senderSuffix: sender.slice(-4),
      },
    });
  }

  const availableBindings = configs.map((c) => c.diagnostic.keyBinding);
  for (const config of configs) config.diagnostic.availableBindings = availableBindings;
  return configs;
}

export function isInfobipConfigured(): boolean {
  return Boolean(
    (process.env.INFOBIP_API_KEY_V2 || process.env.INFOBIP_API_KEY) &&
      process.env.INFOBIP_BASE_URL &&
      process.env.INFOBIP_WHATSAPP_SENDER,
  );
}

export async function sendInfobipWhatsApp(
  input: InfobipSendInput,
): Promise<InfobipSendResult> {
  const configs = await readRuntimeConfigs();
  if (configs.length === 0) {
    return {
      ok: false,
      status: 500,
      error:
        "Infobip WhatsApp credential binding is missing in this runtime (no API key, base URL or sender)",
    };
  }

  const attempted: string[] = [];
  let last: InfobipSendResult | null = null;

  for (const config of configs) {
    attempted.push(config.diagnostic.keyBinding);
    const result = await sendWithConfig(config, input, [...attempted]);
    if (result.ok) return result;
    last = result;
    // Only an authentication rejection is worth retrying with another binding;
    // template or recipient errors would fail identically on every key.
    const isAuthFailure =
      result.status === 401 ||
      result.status === 403 ||
      /invalid login details|unauthorized/i.test(result.error ?? "");
    if (!isAuthFailure) break;
    console.warn(
      `[infobip] ${config.diagnostic.keyBinding} rejected (${result.status}) — trying next binding`,
    );
  }

  return last!;
}

async function sendWithConfig(
  config: RuntimeConfig,
  input: InfobipSendInput,
  attemptedBindings: string[],
): Promise<InfobipSendResult> {


  const to = normalizeNumber(input.to);
  const sender = config.sender;

  let path: string;
  let payload: Record<string, unknown>;

  if (input.templateName) {
    path = "/whatsapp/1/message/template";
    const templateData: Record<string, unknown> = {
      body: { placeholders: input.placeholders ?? [] },
    };
    if (input.headerImageUrl) {
      templateData.header = { type: "IMAGE", mediaUrl: input.headerImageUrl };
    }
    payload = {
      messages: [
        {
          from: sender,
          to,
          content: {
            templateName: input.templateName,
            templateData,
            language: input.templateLanguage ?? "en",
          },
        },
      ],
    };
  } else if (input.mediaUrl) {
    path = "/whatsapp/1/message/image";
    payload = {
      from: sender,
      to,
      content: { mediaUrl: input.mediaUrl, caption: input.body ?? undefined },
    };
  } else if (input.body) {
    path = "/whatsapp/1/message/text";
    payload = { from: sender, to, content: { text: input.body } };
  } else {
    return { ok: false, status: 400, error: "Either body or templateName is required" };
  }

  try {
    const resp = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `App ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    const responseRequestId =
      resp.headers.get("x-request-id") ??
      resp.headers.get("x-correlation-id") ??
      resp.headers.get("x-infobip-request-id") ??
      undefined;
    const diagnostic: InfobipRuntimeDiagnostic = {
      ...config.diagnostic,
      responseRequestId,
      attemptedBindings,
    };
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw */
    }

    // Template sends return { messages: [...] }; single sends return the message object.
    const message = Array.isArray(json?.messages) ? json.messages[0] : json;
    const groupName: string | undefined = message?.status?.groupName;
    const providerError: string | undefined =
      json?.requestError?.serviceException?.text ??
      message?.status?.description ??
      undefined;

    if (!resp.ok || groupName === "REJECTED") {
      // Rejections are the case we cannot reproduce outside production, so
      // capture Infobip's own identifiers here. None of this is secret and it
      // is exactly what Infobip support needs to trace the request.
      diagnostic.httpStatus = resp.status;
      diagnostic.providerMessageId =
        json?.requestError?.serviceException?.messageId ?? message?.status?.name ?? undefined;
      diagnostic.rawErrorBody = text?.slice(0, 300);
      const msg = providerError ?? text?.slice(0, 300) ?? `HTTP ${resp.status}`;
      console.error("[infobip] send failed", resp.status, msg, diagnostic);
      return { ok: false, status: resp.status || 502, error: msg, diagnostic };
    }


    console.info("[infobip] send accepted", resp.status, message?.messageId, diagnostic);
    return { ok: true, status: resp.status, sid: message?.messageId, diagnostic };
  } catch (e: any) {
    console.error("[infobip] network error", e?.message ?? e);
    return {
      ok: false,
      status: 0,
      error: e?.message ?? "Network error",
      diagnostic: { ...config.diagnostic, attemptedBindings },
    };
  }

}
