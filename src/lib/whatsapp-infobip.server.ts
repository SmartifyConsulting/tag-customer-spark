// Server-only Infobip WhatsApp delivery adapter.
//
// Infobip is a pure delivery mechanism — no business logic lives here.
// Docs: https://www.infobip.com/docs/api/channels/whatsapp
//
// Required env:
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
};

function normalizeNumber(num: string): string {
  const trimmed = num.trim();
  const stripped = trimmed.startsWith("whatsapp:")
    ? trimmed.slice("whatsapp:".length)
    : trimmed;
  // Infobip expects digits only (no leading "+").
  return stripped.replace(/[^\d]/g, "");
}

function baseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
  const apiKey = process.env.INFOBIP_API_KEY;
  const rawBase = process.env.INFOBIP_BASE_URL;
  const from = process.env.INFOBIP_WHATSAPP_SENDER;

  if (!apiKey || !rawBase || !from) {
    return { ok: false, status: 500, error: "Infobip WhatsApp is not configured" };
  }

  const to = normalizeNumber(input.to);
  const sender = normalizeNumber(from);

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
    const resp = await fetch(`${baseUrl(rawBase)}${path}`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
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
      console.error("[infobip] send failed", resp.status, msg);
      return { ok: false, status: resp.status || 502, error: msg };
    }

    return { ok: true, status: resp.status, sid: message?.messageId };
  } catch (e: any) {
    console.error("[infobip] network error", e?.message ?? e);
    return { ok: false, status: 0, error: e?.message ?? "Network error" };
  }
}
