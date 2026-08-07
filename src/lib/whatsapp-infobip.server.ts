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
  keyBinding: "INFOBIP_API_KEY_V2" | "INFOBIP_API_KEY";
  keyFingerprint: string;
  keyLength: number;
  normalizedAppPrefix: boolean;
  normalizedWrappingQuotes: boolean;
  normalizedWhitespace: boolean;
  apiHost: string;
  senderSuffix: string;
  responseRequestId?: string;
};

type RuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  sender: string;
  diagnostic: InfobipRuntimeDiagnostic;
};

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

async function readRuntimeConfig(): Promise<RuntimeConfig | null> {
  // Read inside the request operation. Do not move these values to module scope:
  // production secret bindings can be refreshed independently of this bundle.
  // V2 is a versioned binding created to escape a production platform binding
  // that remained pinned to an older INFOBIP_API_KEY value after replacement.
  // Keep the original name as a fallback for existing environments.
  const v2ApiKey = process.env.INFOBIP_API_KEY_V2;
  const rawApiKey = v2ApiKey ?? process.env.INFOBIP_API_KEY;
  const rawBaseUrl = process.env.INFOBIP_BASE_URL;
  const rawSender = process.env.INFOBIP_WHATSAPP_SENDER;
  if (!rawApiKey || !rawBaseUrl || !rawSender) return null;

  const unwrappedKey = unwrapQuotes(rawApiKey);
  const hadAppPrefix = /^(?:App\s+)+/i.test(unwrappedKey.value);
  const apiKey = unwrappedKey.value.replace(/^(?:App\s+)+/i, "").trim();
  const normalizedWhitespace = apiKey !== rawApiKey;
  const normalizedUrl = normalizeBaseUrl(rawBaseUrl);
  const sender = normalizeNumber(unwrapQuotes(rawSender).value);
  const apiHost = new URL(normalizedUrl).hostname;

  return {
    apiKey,
    baseUrl: normalizedUrl,
    sender,
    diagnostic: {
      keyBinding: v2ApiKey ? "INFOBIP_API_KEY_V2" : "INFOBIP_API_KEY",
      keyFingerprint: await fingerprint(apiKey),
      keyLength: apiKey.length,
      normalizedAppPrefix: hadAppPrefix,
      normalizedWrappingQuotes: unwrappedKey.changed,
      normalizedWhitespace,
      apiHost,
      senderSuffix: sender.slice(-4),
    },
  };
}

export function isInfobipConfigured(): boolean {
  return Boolean(
    process.env.INFOBIP_API_KEY &&
      process.env.INFOBIP_BASE_URL &&
      process.env.INFOBIP_WHATSAPP_SENDER,
  );
}

export async function sendInfobipWhatsApp(
  input: InfobipSendInput,
): Promise<InfobipSendResult> {
  const config = await readRuntimeConfig();
  if (!config) {
    return { ok: false, status: 500, error: "Infobip WhatsApp is not configured" };
  }

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
    const diagnostic = { ...config.diagnostic, responseRequestId };
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
      diagnostic: config.diagnostic,
    };
  }
}
