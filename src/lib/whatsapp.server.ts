// Server-only WhatsApp send helper.
//
// Delivery provider is pluggable:
//   - "infobip" (default when Infobip secrets exist) → direct Infobip API
//   - "twilio"  → Lovable connector gateway (TWILIO_API_KEY + LOVABLE_API_KEY)
// Set WHATSAPP_PROVIDER to force one explicitly.
//
// Import ONLY from server code (createServerFn handlers, server routes,
// or other .server.ts modules). The `.server` suffix keeps it out of the
// client bundle.

import { isInfobipConfigured, sendInfobipWhatsApp } from "@/lib/whatsapp-infobip.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type WhatsAppProvider = "infobip" | "twilio";

export type SendWhatsAppInput = {
  to: string;           // E.164, e.g. "+27821234567" (with or without whatsapp: prefix)
  // Freeform text send. Required unless a template is given instead — WhatsApp
  // only allows freeform sends within 24h of the customer's last inbound
  // message; anything else needs an approved template.
  body?: string;
  mediaUrl?: string | null;
  // --- Twilio approved-template addressing ---
  contentSid?: string;
  contentVariables?: Record<string, string>;
  // --- Infobip approved-template addressing ---
  templateName?: string;
  templateLanguage?: string;
  placeholders?: string[];
  headerImageUrl?: string | null;
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

/** Which delivery provider outbound WhatsApp currently uses. */
export function activeWhatsAppProvider(): WhatsAppProvider {
  const forced = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (forced === "twilio") return "twilio";
  if (forced === "infobip") return "infobip";
  return isInfobipConfigured() ? "infobip" : "twilio";
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  if (activeWhatsAppProvider() === "infobip") {
    return sendInfobipWhatsApp({
      to: input.to,
      body: input.body,
      mediaUrl: input.mediaUrl,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      placeholders: input.placeholders,
      headerImageUrl: input.headerImageUrl,
    });
  }
  return sendTwilioWhatsApp(input);
}

async function sendTwilioWhatsApp({
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
      error: "WhatsApp delivery is not configured",
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
