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

/** Uppercase, strip punctuation, collapse spaces — button labels vary by template. */
function normalizeButton(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type ButtonAction = "watch" | "commit" | "defer" | "unsubscribe";

/** Every reply button across the tag_* templates, and what it means. */
const BUTTON_ACTIONS: Record<string, ButtonAction> = {
  "KEEP AN EYE ON ME": "watch",
  "LETS DO THIS OR IM COMING TO GET YOU": "commit",
  "LETS DO THIS": "commit",
  "LETS JUST TAKE IT SLOW": "defer",
  "I NEED MORE TIME": "defer",
  "ITS NOT YOU ITS ME": "unsubscribe",
  "LETS JUST BE FRIENDS": "unsubscribe",
};

/** Drops a line into the customer's conversation so staff see what happened. */
async function logConversationNote(
  supabaseAdmin: any,
  customer: { id: string; retailer_id: string },
  body: string,
): Promise<void> {
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
      })
      .select("id")
      .single();
    convo = ins;
  }
  if (!convo?.id) return;

  await supabaseAdmin.from("conversation_messages").insert({
    conversation_id: convo.id,
    retailer_id: customer.retailer_id,
    direction: "inbound",
    channel: "whatsapp",
    body,
    is_internal: false,
    status: "delivered",
    sent_at: new Date().toISOString(),
  });
}


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

          const button = normalizeButton(rawBody);
          const action = BUTTON_ACTIONS[button];

          // Quick-reply purchase intent on an alert template.
          if (action || body === "COLLECTION" || body === "DELIVERY") {
            const fulfillment =
              body === "DELIVERY" ? "delivery" : body === "COLLECTION" ? "collection" : null;

            const { data: lastNotif } = await supabaseAdmin
              .from("notification_history")
              .select("id, payload, created_at")
              .eq("customer_id", customer.id)
              .not("payload->>product_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const productId = (lastNotif?.payload as any)?.product_id as string | undefined;
            if (!productId) continue;

            const { data: product } = await supabaseAdmin
              .from("products")
              .select("id, name, display_name, price_cents, sale_price_cents, currency, stock_qty, intent_score")
              .eq("id", productId)
              .maybeSingle();

            const productName =
              (product as any)?.display_name || (product as any)?.name || "the product";

            const watchRepo = await import("@/lib/watch-repository.server");
            const watch = await watchRepo.findWatch(supabaseAdmin, customer.id, productId);

            let note: string | null = null;

            if (action === "watch") {
              // "Keep an eye on me" — this tap IS the opt-in.
              if (watch && product) {
                await watchRepo.activateWatch(supabaseAdmin, watch.id, product as any);
              }
              await supabaseAdmin
                .from("customers")
                .update({
                  status: "subscribed",
                  notify_consent_at: new Date().toISOString(),
                } as any)
                .eq("id", customer.id);
              note = `✅ Opted in to updates on ${productName} ("Keep an eye on me").`;
            } else if (action === "defer") {
              if (watch) await watchRepo.deferWatch(supabaseAdmin, watch.id);
              note = `🕒 Still deciding on ${productName} — asked us to take it slow.`;
            } else if (action === "unsubscribe") {
              if (watch) await watchRepo.cancelWatch(supabaseAdmin, watch.id);
              await supabaseAdmin
                .from("customer_interests")
                .update({ status: "expired" } as any)
                .eq("customer_id", customer.id)
                .eq("product_id", productId);
              note = `🚫 Unsubscribed from updates on ${productName} (this product only).`;
            } else {
              // "Let's do this…" or a collection/delivery quick reply — a commitment to buy.
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
                amount_cents:
                  (product as any)?.sale_price_cents ?? (product as any)?.price_cents ?? 0,
                currency: (product as any)?.currency ?? "ZAR",
                status: "pending",
                fulfillment: fulfillment ?? "collection",
              } as any);
              note = `🛒 Committed to buy ${productName} — ready for the store to fulfil.`;
            }

            if (note) {
              await logConversationNote(supabaseAdmin, customer, note);
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
