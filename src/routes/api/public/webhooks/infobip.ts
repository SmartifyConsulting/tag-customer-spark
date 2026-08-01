// Infobip webhook — inbound WhatsApp messages AND delivery reports.
//
// Infobip does not sign webhooks, so the endpoint is protected by a shared
// secret. Configure the URL in Infobip as:
//   https://tag-tech.co.za/api/public/webhooks/infobip?secret=<INFOBIP_WEBHOOK_SECRET>
// (a custom header `X-Tag-Secret` is accepted too).
//
// Inbound payload:  { results: [ { from, to, messageId, message: { type, text } } ] }
// Delivery report:  { results: [ { messageId, status: { groupName, name, description }, error } ] }

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const UNSUBSCRIBE_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "END",
  "QUIT",
  "CANCEL",
]);

const MARKETING_OPT_IN_BUTTON_TEXT = "YES, KEEP ME POSTED";

function secretMatches(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function toE164(num: string | undefined | null): string | null {
  if (!num) return null;
  const digits = String(num).replace(/[^\d]/g, "");
  return digits ? `+${digits}` : null;
}

/** Infobip delivery-report group/status → notification_history.status */
function mapStatus(groupName?: string, name?: string): string {
  const g = (groupName ?? "").toUpperCase();
  const n = (name ?? "").toUpperCase();
  if (n === "READ" || g === "READ") return "read";
  if (g === "DELIVERED") return "delivered";
  if (g === "PENDING") return "queued";
  if (g === "REJECTED" || g === "UNDELIVERABLE" || g === "EXPIRED") return "failed";
  if (g === "SENT") return "sent";
  return "sent";
}

/** Extracts the inbound text or button payload from an Infobip result. */
function inboundText(message: any): string {
  if (!message) return "";
  if (typeof message === "string") return message;
  return (
    message.text ??
    message.payload ??
    message.title ??
    message.caption ??
    ""
  );
}

export const Route = createFileRoute("/api/public/webhooks/infobip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.INFOBIP_WEBHOOK_SECRET;
        if (expected) {
          const url = new URL(request.url);
          const provided =
            url.searchParams.get("secret") ?? request.headers.get("x-tag-secret") ?? "";
          if (!secretMatches(provided, expected)) {
            console.warn("[infobip-webhook] invalid secret");
            return new Response("Unauthorized", { status: 401 });
          }
        } else {
          console.warn("[infobip-webhook] INFOBIP_WEBHOOK_SECRET not set — skipping auth check");
        }

        let payload: any = null;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const results: any[] = Array.isArray(payload?.results)
          ? payload.results
          : payload
            ? [payload]
            : [];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        for (const result of results) {
          // ---- Delivery report ----
          if (result?.status && result?.messageId && !result?.message) {
            const mapped = mapStatus(result.status.groupName, result.status.name);
            const errorText =
              result.error?.name || result.error?.description
                ? `${result.error?.name ?? ""} ${result.error?.description ?? ""}`.trim()
                : null;
            await supabaseAdmin
              .from("notification_history")
              .update({ status: mapped, error: errorText } as any)
              .eq("provider_message_sid", result.messageId);
            continue;
          }

          // ---- Inbound message ----
          const from = toE164(result?.from);
          const rawBody = inboundText(result?.message);
          const body = String(rawBody).trim().toUpperCase();
          if (!from || !body) continue;

          if (UNSUBSCRIBE_KEYWORDS.has(body)) {
            await supabaseAdmin
              .from("customers")
              .update({
                status: "unsubscribed",
                notify_consent_at: null,
                marketing_consent_at: null,
              } as any)
              .eq("whatsapp_e164", from);
            continue;
          }

          if (body === "START") {
            await supabaseAdmin
              .from("customers")
              .update({
                status: "subscribed",
                notify_consent_at: new Date().toISOString(),
              } as any)
              .eq("whatsapp_e164", from);
            continue;
          }

          if (body === MARKETING_OPT_IN_BUTTON_TEXT) {
            await supabaseAdmin
              .from("customers")
              .update({ marketing_consent_at: new Date().toISOString() } as any)
              .eq("whatsapp_e164", from);
            continue;
          }

          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id, retailer_id")
            .eq("whatsapp_e164", from)
            .maybeSingle();
          if (!customer) continue;

          // Quick-reply purchase intent on an alert template.
          if (body === "COLLECTION" || body === "DELIVERY") {
            const fulfillment = body === "COLLECTION" ? "collection" : "delivery";
            const { data: lastNotif } = await supabaseAdmin
              .from("notification_history")
              .select("id, payload, created_at")
              .eq("customer_id", customer.id)
              .not("payload->>product_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const productId = (lastNotif?.payload as any)?.product_id as string | undefined;
            if (productId) {
              const { data: product } = await supabaseAdmin
                .from("products")
                .select("price_cents, sale_price_cents, currency")
                .eq("id", productId)
                .maybeSingle();

              await supabaseAdmin
                .from("customer_interests")
                .update({ status: "converted" } as any)
                .eq("customer_id", customer.id)
                .eq("product_id", productId);

              await supabaseAdmin.from("sales_recoveries").insert({
                retailer_id: customer.retailer_id,
                customer_id: customer.id,
                product_id: productId,
                notification_id: lastNotif?.id ?? null,
                amount_cents: product?.sale_price_cents ?? product?.price_cents ?? 0,
                currency: product?.currency ?? "ZAR",
                status: "pending",
                fulfillment,
              } as any);
            }
            continue;
          }

          // Free-form reply → log into the customer's conversation.
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
              body: String(rawBody),
              is_internal: false,
            } as any);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
