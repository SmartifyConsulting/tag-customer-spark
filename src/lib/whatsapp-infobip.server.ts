// Server-only Infobip WhatsApp delivery adapter.
//
// Infobip is a pure delivery mechanism — no business logic lives here.
// Docs: https://www.infobip.com/docs/api/channels/whatsapp
//
// Required runtime env:
//   INFOBIP_API_KEY          — the Infobip credential (legacy _V2/_V3 accepted)
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
  /**
   * Button components the approved template declares. WhatsApp requires every
   * QUICK_REPLY button to carry its payload parameter at send time; omitting
   * them is rejected with error 7008 (EC_INVALID_TEMPLATE_ARGS).
   */
  buttons?: Array<{ type: "QUICK_REPLY"; parameter: string }>;
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
  /** The single credential binding this runtime uses. */
  availableBindings?: string[];
  /** Kept for log/diagnostic compatibility — always the single binding. */
  attemptedBindings?: string[];

  /** Provider HTTP status on failure. */
  httpStatus?: number;
  /** Infobip's own error identifier, e.g. "UNAUTHORIZED". */
  providerMessageId?: string;
  /** Truncated raw provider error body (never contains our credentials). */
  rawErrorBody?: string;
  /** Which egress path carried the call: direct from the app, or the DB relay. */
  transport?: "direct" | "relay";

};




type RuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  sender: string;
  diagnostic: InfobipRuntimeDiagnostic;
};

/**
 * Candidate Infobip credential bindings, in priority order. The current secret
 * is `INFOBIP_API_KEY`; the `_V2`/`_V3` names are legacy fallbacks kept so an
 * older deployment binding keeps working.
 */
const KEY_BINDINGS = ["INFOBIP_API_KEY", "INFOBIP_API_KEY_V2", "INFOBIP_API_KEY_V3"] as const;

/** First credential binding present in this runtime, with its name. */
export function resolveInfobipKeyBinding(): { name: string; value: string } | null {
  for (const name of KEY_BINDINGS) {
    const value = process.env[name];
    if (value && value.trim()) return { name, value };
  }
  return null;
}




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
 * Resolves the single Infobip credential for this runtime.
 *
 * Exactly one binding is used everywhere (authenticated server functions and
 * the public `/api/public/*` routes), so every path authenticates identically
 * and a rejection is reported rather than masked by a fallback key.
 */
async function readRuntimeConfig(): Promise<RuntimeConfig | null> {
  // Read inside the request operation. Do not move these values to module
  // scope: bindings are injected per request in the deployed runtime.
  const rawBaseUrl = process.env.INFOBIP_BASE_URL;
  const rawSender = process.env.INFOBIP_WHATSAPP_SENDER;
  const binding = resolveInfobipKeyBinding();
  if (!rawBaseUrl || !rawSender || !binding) return null;
  const raw = binding.value;

  const normalizedUrl = normalizeBaseUrl(rawBaseUrl);
  const sender = normalizeNumber(unwrapQuotes(rawSender).value);
  const apiHost = new URL(normalizedUrl).hostname;

  const unwrappedKey = unwrapQuotes(raw);
  const hadAppPrefix = /^(?:App\s+)+/i.test(unwrappedKey.value);
  const apiKey = unwrappedKey.value.replace(/^(?:App\s+)+/i, "").trim();
  if (!apiKey) return null;

  // Safe diagnostics only — never the key, never the full sender.
  console.info(
    `[infobip] config binding=${binding.name} keyLength=${apiKey.length} host=${apiHost} senderSuffix=${sender.slice(-4)}`,
  );

  return {
    apiKey,
    baseUrl: normalizedUrl,
    sender,
    diagnostic: {
      keyBinding: binding.name,
      keyFingerprint: await fingerprint(apiKey),
      keyLength: apiKey.length,
      normalizedAppPrefix: hadAppPrefix,
      normalizedWrappingQuotes: unwrappedKey.changed,
      normalizedWhitespace: apiKey !== raw,
      apiHost,
      senderSuffix: sender.slice(-4),
      availableBindings: KEY_BINDINGS.filter((n) => Boolean(process.env[n])),
    },
  };
}

/** Names the exact parts that are absent, so the UI diagnostic is actionable. */
function missingBindingMessage(): string {
  const missing: string[] = [];
  if (!resolveInfobipKeyBinding()) missing.push(`API key (${KEY_BINDINGS.join(" or ")})`);
  if (!process.env.INFOBIP_BASE_URL) missing.push("INFOBIP_BASE_URL");
  if (!process.env.INFOBIP_WHATSAPP_SENDER) missing.push("INFOBIP_WHATSAPP_SENDER");
  return `Infobip WhatsApp credential binding is missing in this runtime: ${
    missing.length ? missing.join(", ") : "value present but empty after normalisation"
  }`;
}

export function isInfobipConfigured(): boolean {
  return Boolean(
    resolveInfobipKeyBinding() &&
      process.env.INFOBIP_BASE_URL &&
      process.env.INFOBIP_WHATSAPP_SENDER,
  );
}

export async function sendInfobipWhatsApp(
  input: InfobipSendInput,
): Promise<InfobipSendResult> {
  const config = await readRuntimeConfig();
  if (!config) {
    const error = missingBindingMessage();
    console.error(`[infobip] ${error}`);
    return { ok: false, status: 500, error };
  }

  return sendWithConfig(config, input, [config.diagnostic.keyBinding]);
}

/**
 * Read-only authentication check against Infobip from this exact runtime.
 * Sends no WhatsApp message, so it can be run safely at any time to tell an
 * authentication failure apart from a template or recipient failure.
 */
export async function checkInfobipAuth(): Promise<{
  ok: boolean;
  status: number;
  error: string | null;
  diagnostic: InfobipRuntimeDiagnostic | null;
}> {
  const config = await readRuntimeConfig();
  if (!config) {
    return {
      ok: false,
      status: 500,
      error: missingBindingMessage(),
      diagnostic: null,
    };
  }


  try {
    const resp = await infobipCall(config, "/whatsapp/1/senders", null);
    const raw = resp.text.slice(0, 300);
    return {
      ok: resp.ok,
      status: resp.status,
      error: resp.ok ? null : raw || `Infobip returned ${resp.status}`,
      diagnostic: {
        ...config.diagnostic,
        httpStatus: resp.status,
        transport: resp.transport,
      },
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: (e as Error).message,
      diagnostic: config.diagnostic,
    };
  }
}

/**
 * Operational read-only probes that deliberately share the exact RuntimeConfig
 * and transport used by message sends. Returned diagnostics contain no secret
 * values.
 */
export async function probeInfobipRuntime(): Promise<{
  ok: boolean;
  status: number;
  error: string | null;
  diagnostic: InfobipRuntimeDiagnostic | null;
  probes: Array<{ path: string; status: number; body: string; transport: "direct" | "relay" }>;
}> {
  const config = await readRuntimeConfig();
  if (!config) {
    return {
      ok: false,
      status: 500,
      error: missingBindingMessage(),
      diagnostic: null,
      probes: [],
    };
  }

  const paths = ["/account/1/balance", "/whatsapp/2/senders"];
  const probes = await Promise.all(
    paths.map(async (path) => {
      const response = await infobipCall(config, path, null);
      return {
        path,
        status: response.status,
        body: response.text.slice(0, 200),
        transport: response.transport,
      };
    }),
  );
  const failed = probes.find((probe) => probe.status < 200 || probe.status >= 300);

  return {
    ok: !failed,
    status: failed?.status ?? 200,
    error: failed ? failed.body || `Infobip returned ${failed.status}` : null,
    diagnostic: config.diagnostic,
    probes,
  };
}

/**
 * Read-only delivery-report lookup for a single Infobip message id.
 *
 * Uses the same credential binding and transport as the send path, and never
 * returns the API key. Recipient MSISDNs are masked so the diagnostic can be
 * surfaced or logged without exposing personal data.
 */
export async function lookupInfobipMessageStatus(messageId: string): Promise<{
  ok: boolean;
  status: number;
  error: string | null;
  diagnostic: InfobipRuntimeDiagnostic | null;
  endpoint: string | null;
  result: Record<string, unknown> | null;
  attempts: Array<{ path: string; status: number; transport: "direct" | "relay" }>;
}> {
  const config = await readRuntimeConfig();
  if (!config) {
    return {
      ok: false,
      status: 500,
      error: missingBindingMessage(),
      diagnostic: null,
      endpoint: null,
      result: null,
      attempts: [],
    };
  }

  const id = encodeURIComponent(messageId);
  // /whatsapp/2/logs is the channel log; the others are kept as fallbacks for
  // accounts where only the legacy report queue is enabled.
  const paths = [
    `/whatsapp/2/logs?messageId=${id}`,
    `/whatsapp/1/reports?messageId=${id}`,
    `/resource/1/logs?messageId=${id}`,
  ];

  const attempts: Array<{ path: string; status: number; transport: "direct" | "relay" }> = [];
  for (const path of paths) {
    const resp = await infobipCall(config, path, null);
    attempts.push({ path: path.split("?")[0], status: resp.status, transport: resp.transport });
    if (!resp.ok) continue;

    let json: any = null;
    try {
      json = resp.text ? JSON.parse(resp.text) : null;
    } catch {
      continue;
    }
    const row = Array.isArray(json?.results) ? json.results[0] : null;
    if (!row) continue;

    return {
      ok: true,
      status: resp.status,
      error: null,
      attempts,
      diagnostic: { ...config.diagnostic, transport: resp.transport },
      endpoint: path.split("?")[0],

      result: {
        messageId: row.messageId ?? null,
        sender: row.sender ?? null,
        destination: maskMsisdn(row.destination),
        sentAt: row.sentAt ?? null,
        doneAt: row.doneAt ?? null,
        status: row.status ?? null,
        error: row.error ?? null,
        templateName: row.content?.templateName ?? null,
        templateLanguage: row.content?.language?.code ?? row.content?.language ?? null,
        headerFormat: row.content?.mediaTemplateHeader?.format ?? null,
        bodyPlaceholderCount: Array.isArray(row.content?.mediaTemplateBody?.placeholders)
          ? row.content.mediaTemplateBody.placeholders.length
          : null,
      },
    };
  }

  return {
    ok: false,
    status: attempts[attempts.length - 1]?.status ?? 0,
    error: "No delivery log found for this message id on any Infobip log endpoint",
    diagnostic: config.diagnostic,
    endpoint: null,
    result: null,
    attempts,
  };
}

/** Keeps country context but hides the subscriber number. */
function maskMsisdn(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `${digits.slice(0, 3)}${"*".repeat(Math.max(0, digits.length - 6))}${digits.slice(-3)}`;
}


/**
 * Outbound egress path for Infobip calls.
 *
 * The deployed app runtime reaches the internet over IPv6 and Infobip rejects
 * those requests with 401 "Invalid login details" — the identical credential
 * returns 200 over IPv4. So we call Infobip directly first and, on a 401,
 * repeat the request through the database's network path (pg_net), which has a
 * stable IPv4 origin Infobip accepts. Once a 401 is seen in this isolate we go
 * straight through the relay to avoid paying for a doomed direct attempt.
 */
let preferRelay = false;

type InfobipCallResult = {
  ok: boolean;
  status: number;
  text: string;
  requestId?: string;
  transport: "direct" | "relay";
};

async function directCall(
  config: RuntimeConfig,
  path: string,
  payload: Record<string, unknown> | null,
): Promise<InfobipCallResult> {
  const resp = await fetch(`${config.baseUrl}${path}`, {
    method: payload ? "POST" : "GET",
    headers: {
      Authorization: `App ${config.apiKey}`,
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return {
    ok: resp.ok,
    status: resp.status,
    text: await resp.text(),
    requestId:
      resp.headers.get("x-request-id") ??
      resp.headers.get("x-correlation-id") ??
      resp.headers.get("x-infobip-request-id") ??
      undefined,
    transport: "direct",
  };
}

async function relayCall(
  config: RuntimeConfig,
  path: string,
  payload: Record<string, unknown> | null,
): Promise<InfobipCallResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: id, error } = await supabaseAdmin.rpc("infobip_relay_request", {
    p_base: config.baseUrl,
    p_path: path,
    p_api_key: config.apiKey,
    p_payload: payload as never,
  });
  if (error || id == null) {
    return {
      ok: false,
      status: 0,
      text: error?.message ?? "Relay did not accept the request",
      transport: "relay",
    };
  }

  // pg_net performs the call asynchronously, so poll for the stored response.
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const { data } = await supabaseAdmin.rpc("infobip_relay_response", {
      p_id: id as number,
    });
    const row = Array.isArray(data) ? (data[0] as any) : null;
    if (row) {
      const status: number = row.status_code ?? 0;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: row.content ?? row.error_msg ?? "",
        transport: "relay",
      };
    }
  }
  return { ok: false, status: 504, text: "Relay timed out waiting for Infobip", transport: "relay" };
}

async function infobipCall(
  config: RuntimeConfig,
  path: string,
  payload: Record<string, unknown> | null,
): Promise<InfobipCallResult> {
  if (preferRelay) return relayCall(config, path, payload);

  const direct = await directCall(config, path, payload);
  if (direct.status !== 401) return direct;

  console.warn("[infobip] direct egress rejected (401) — retrying via database relay");
  preferRelay = true;
  return relayCall(config, path, payload);
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
    const resp = await infobipCall(config, path, payload);

    const text = resp.text;
    const diagnostic: InfobipRuntimeDiagnostic = {
      ...config.diagnostic,
      responseRequestId: resp.requestId,
      attemptedBindings,
      transport: resp.transport,
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
