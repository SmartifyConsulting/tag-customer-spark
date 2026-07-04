// Server-only Twilio WhatsApp helper. Routes all sends through the Lovable
// connector gateway using TWILIO_API_KEY + LOVABLE_API_KEY.
//
// Import ONLY from server code (createServerFn handlers, server routes,
// or other .server.ts modules). The `.server` suffix keeps it out of the
// client bundle.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type SendWhatsAppInput = {
  to: string;           // E.164, e.g. "+27821234567" (with or without whatsapp: prefix)
  body: string;
  mediaUrl?: string | null;
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

  const form = new URLSearchParams({
    To: normalizeWhatsApp(to),
    From: normalizeWhatsApp(FROM),
    Body: body,
  });
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
