// Server-only Twilio WhatsApp helper. Routes all sends through the Lovable
// connector gateway using TWILIO_API_KEY + LOVABLE_API_KEY.
//
// Import ONLY from server code (createServerFn handlers, server routes,
// or other .server.ts modules). The `.server` suffix keeps it out of the
// client bundle.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type SendWhatsAppInput = {
  to: string;           // E.164, e.g. "+27821234567" (with or without whatsapp: prefix)
  // Freeform text send. Required unless `contentSid` is given instead — WhatsApp
  // only allows freeform sends within 24h of the customer's last inbound
  // message; anything else needs an approved Content Template (see contentSid).
  body?: string;
  mediaUrl?: string | null;
  // Send a pre-approved Twilio Content Template instead of freeform text —
  // required for business-initiated messages outside the 24h session window
  // (e.g. an automated price-drop/restock alert). `contentVariables` keys are
  // the template's numbered placeholders as strings, e.g. {"1": "...", "2": "..."}.
  contentSid?: string;
  contentVariables?: Record<string, string>;
};

export type SendWhatsAppResult = {
  ok: boolean;
  status: number;
  sid?: string;
  error?: string;
};

function normalizeWhatsApp(num: string): string {
  const trimmed = num.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

export async function sendWhatsApp({
  to,
  body,
  mediaUrl,
  contentSid,
  contentVariables,
}: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  const FROM = process.env.TWILIO_WHATSAPP_FROM;

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !FROM) {
    return {
      ok: false,
      status: 500,
      error: "Twilio WhatsApp is not configured",
    };
  }
  if (!contentSid && !body) {
    return { ok: false, status: 400, error: "Either body or contentSid is required" };
  }

  const form = new URLSearchParams({
    To: normalizeWhatsApp(to),
    From: normalizeWhatsApp(FROM),
  });
  if (contentSid) {
    form.append("ContentSid", contentSid);
    if (contentVariables) form.append("ContentVariables", JSON.stringify(contentVariables));
  } else {
    form.append("Body", body!);
  }
  if (mediaUrl) form.append("MediaUrl", mediaUrl);

  try {
    const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const text = await resp.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw */
    }
    if (!resp.ok) {
      const msg = json?.message ?? text?.slice(0, 200) ?? `HTTP ${resp.status}`;
      console.error("[whatsapp] send failed", resp.status, msg);
      return { ok: false, status: resp.status, error: msg };
    }
    return { ok: true, status: resp.status, sid: json?.sid };
  } catch (e: any) {
    console.error("[whatsapp] network error", e?.message ?? e);
    return { ok: false, status: 0, error: e?.message ?? "Network error" };
  }
}
