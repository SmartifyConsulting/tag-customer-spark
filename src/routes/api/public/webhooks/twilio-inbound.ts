// Twilio inbound + status callback webhook.
// - Inbound "STOP" (or STOPALL, UNSUBSCRIBE, END, QUIT, CANCEL): unsubscribe the customer.
// - Status callbacks: update notification_history.status by MessageSid.
//
// Signature validation:
// Twilio signs POST requests as HMAC-SHA1 of the full URL + concatenated
// (sorted) form params, base64-encoded, in the `X-Twilio-Signature` header.
// Uses TWILIO_AUTH_TOKEN when configured; otherwise degrades to accepting
// requests without signature validation (dev/sandbox only) and logs a warning.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const UNSUBSCRIBE_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "END",
  "QUIT",
  "CANCEL",
]);

function verifyTwilioSignature(
  authToken: string,
  fullUrl: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const keys = Object.keys(params).sort();
  const data = keys.reduce((acc, k) => acc + k + params[k], fullUrl);
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function normalizeE164(waAddr: string | undefined | null): string | null {
  if (!waAddr) return null;
  const trimmed = waAddr.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed.slice("whatsapp:".length) : trimmed;
}

export const Route = createFileRoute("/api/public/webhooks/twilio-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const params: Record<string, string> = {};
        new URLSearchParams(rawBody).forEach((value, key) => {
          params[key] = value;
        });

        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const signature = request.headers.get("x-twilio-signature") ?? "";
        if (authToken) {
          const proto = request.headers.get("x-forwarded-proto") ?? "https";
          const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
          const path = new URL(request.url).pathname;
          const fullUrl = `${proto}://${host}${path}`;
          if (!verifyTwilioSignature(authToken, fullUrl, params, signature)) {
            console.warn("[twilio-inbound] invalid signature");
            return new Response("Invalid signature", { status: 401 });
          }
        } else {
          console.warn("[twilio-inbound] TWILIO_AUTH_TOKEN not set — skipping signature check");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Status callback for a previously sent message
        const messageSid = params.MessageSid;
        const messageStatus = params.MessageStatus?.toLowerCase();
        if (messageSid && messageStatus && !params.Body) {
          const statusMap: Record<string, string> = {
            queued: "queued",
            sent: "sent",
            delivered: "delivered",
            read: "read",
            failed: "failed",
            undelivered: "failed",
          };
          const mapped = statusMap[messageStatus] ?? messageStatus;
          await supabaseAdmin
            .from("notification_history")
            .update({
              status: mapped,
              error_message: params.ErrorMessage ?? null,
            } as any)
            .eq("provider_message_sid", messageSid);
          return new Response("<Response/>", {
            headers: { "Content-Type": "text/xml" },
          });
        }

        // Inbound message
        const from = normalizeE164(params.From);
        const body = (params.Body ?? "").trim().toUpperCase();

        if (from && UNSUBSCRIBE_KEYWORDS.has(body)) {
          await supabaseAdmin
            .from("customers")
            .update({
              status: "unsubscribed",
              notify_consent_at: null,
              marketing_consent_at: null,
            } as any)
            .eq("whatsapp_e164", from);
          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You've been unsubscribed. Reply START to opt back in.</Message></Response>`;
          return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
        }

        if (from && body === "START") {
          await supabaseAdmin
            .from("customers")
            .update({
              status: "subscribed",
              notify_consent_at: new Date().toISOString(),
            } as any)
            .eq("whatsapp_e164", from);
          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Welcome back — you're subscribed to updates again.</Message></Response>`;
          return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
        }

        // Log free-form inbound messages into a conversation if a customer exists
        if (from && body) {
          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id, retailer_id")
            .eq("whatsapp_e164", from)
            .maybeSingle();
          if (customer) {
            let { data: convo } = await supabaseAdmin
              .from("conversations")
              .select("id")
              .eq("customer_id", customer.id)
              .eq("retailer_id", customer.retailer_id)
              .maybeSingle();
            if (!convo) {
              const { data: ins } = await supabaseAdmin
                .from("conversations")
                .insert({
                  customer_id: customer.id,
                  retailer_id: customer.retailer_id,
                  status: "open",
                  subject: "WhatsApp reply",
                } as any)
                .select("id")
                .single();
              convo = ins as any;
            }
            if (convo?.id) {
              await supabaseAdmin.from("conversation_messages").insert({
                conversation_id: convo.id,
                direction: "inbound",
                channel: "whatsapp",
                body: params.Body ?? "",
                is_internal: false,
              } as any);
            }
          }
        }

        return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>", {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
