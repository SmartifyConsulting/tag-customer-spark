import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";

const interestSchema = z.object({
  gtin: z.string().min(1).max(20),
  whatsapp: z.string().min(5).max(40),
});

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validGtin14(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const g = digits.padStart(14, "0");
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = Number(g[i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== Number(g[13])) return null;
  return g;
}

export const Route = createFileRoute("/api/public/scan/barcode-interest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          const body = await request.json();
          parsed = interestSchema.parse(body);
        } catch (e: any) {
          return jsonRes({ ok: false, error: "Invalid input" }, 400);
        }

        const gtin14 = validGtin14(parsed.gtin);
        if (!gtin14) return jsonRes({ ok: false, error: "Invalid GTIN" }, 400);

        if (!isValidPhoneNumber(parsed.whatsapp)) {
          return jsonRes({ ok: false, error: "Invalid phone number" }, 400);
        }
        const phone = parsePhoneNumber(parsed.whatsapp);
        const e164 = phone.number;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { findActiveProductByGtin } = await import("@/lib/gtin-lookup.server");

        // Must match the passport page's resolution exactly (padded/unpadded
        // GTIN + SKU fallback) — matching only the padded 14-digit form made
        // this return "Product not found" for pages that loaded fine.
        const product = await findActiveProductByGtin(
          supabaseAdmin,
          gtin14,
          "id, retailer_id, store_id, name, image_url, hero_image, thumbnail_url",
        );

        if (!product) {
          return jsonRes({ ok: false, error: "Product not found" }, 404);
        }


        const productName = (product as any).name ?? "this product";
        const productImage =
          (product as any).hero_image ?? (product as any).image_url ?? (product as any).thumbnail_url ?? "";

        const now = new Date().toISOString();

        // Upsert customer on (retailer_id, whatsapp_e164) — phone only, no name captured.
        const { data: existing } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("retailer_id", (product as any).retailer_id)
          .eq("whatsapp_e164", e164)
          .maybeSingle();

        let customerId: string;
        if (existing) {
          await supabaseAdmin
            .from("customers")
            .update({ notify_consent_at: now, status: "subscribed" })
            .eq("id", existing.id);
          customerId = existing.id as string;
        } else {
          const { data: ins, error: insErr } = await supabaseAdmin
            .from("customers")
            .insert({
              retailer_id: (product as any).retailer_id,
              whatsapp_e164: e164,
              opted_in_at: now,
              notify_consent_at: now,
              status: "subscribed",
              source: "barcode_scan",
            })
            .select("id")
            .single();
          if (insErr) return jsonRes({ ok: false, error: insErr.message }, 500);
          customerId = ins!.id as string;
        }

        // Upsert customer_interest (one active per customer+product)
        const { data: existingInterest } = await supabaseAdmin
          .from("customer_interests")
          .select("id")
          .eq("customer_id", customerId)
          .eq("product_id", (product as any).id)
          .maybeSingle();

        if (!existingInterest) {
          await supabaseAdmin.from("customer_interests").insert({
            customer_id: customerId,
            product_id: (product as any).id,
            retailer_id: (product as any).retailer_id,
            status: "active",
            source: "barcode_scan",
          });
        } else {
          await supabaseAdmin
            .from("customer_interests")
            .update({ status: "active" })
            .eq("id", existingInterest.id);
        }

        // Watch this product for price/stock changes, snapshotting the current
        // price/stock for the Notification Engine.
        const { data: watchedProduct } = await supabaseAdmin
          .from("products")
          .select("price_cents, sale_price_cents, stock_qty, intent_score")
          .eq("id", (product as any).id)
          .maybeSingle();

        const { createOrRefreshWatch } = await import("@/lib/watch-repository.server");
        await createOrRefreshWatch(supabaseAdmin, {
          retailerId: (product as any).retailer_id,
          customerId,
          productId: (product as any).id,
          whatsappNumber: e164,
          product: (watchedProduct as any) ?? {
            price_cents: null,
            sale_price_cents: null,
            stock_qty: 0,
            intent_score: 0,
          },
        });

        // Open or refresh the conversation. The subject and an inbound system
        // message carry the product context so the Inbox shows WHAT the
        // customer scanned, not just that someone opted in.
        let storeName: string | null = null;
        if ((product as any).store_id) {
          const { data: store } = await supabaseAdmin
            .from("stores")
            .select("name")
            .eq("id", (product as any).store_id)
            .maybeSingle();
          storeName = (store as any)?.name ?? null;
        }

        const subject = `Interested in ${productName}`;
        const scanLine =
          `📷 Scanned ${productName} (barcode ${gtin14.replace(/^0+/, "")})` +
          (storeName ? ` at ${storeName}` : "") +
          ` and asked to be notified on WhatsApp.`;

        const { data: convo } = await supabaseAdmin
          .from("conversations")
          .select("id, tags")
          .eq("customer_id", customerId)
          .eq("retailer_id", (product as any).retailer_id)
          .maybeSingle();

        let conversationId = (convo as any)?.id as string | undefined;
        if (!conversationId) {
          const { data: newConvo } = await supabaseAdmin
            .from("conversations")
            .insert({
              customer_id: customerId,
              retailer_id: (product as any).retailer_id,
              store_id: (product as any).store_id,
              status: "open",
              subject,
              tags: storeName ? [storeName] : [],
            })
            .select("id")
            .single();
          conversationId = (newConvo as any)?.id;
        } else {
          const tags = Array.from(
            new Set([...(((convo as any).tags as string[]) ?? []), ...(storeName ? [storeName] : [])]),
          );
          await supabaseAdmin
            .from("conversations")
            .update({ subject, tags, status: "open" })
            .eq("id", conversationId);
        }

        if (conversationId) {
          await supabaseAdmin.from("conversation_messages").insert({
            conversation_id: conversationId,
            retailer_id: (product as any).retailer_id,
            direction: "inbound",
            body: scanLine,
            media_url: productImage || null,
            status: "delivered",
            sent_at: now,
          });
        }

        // Fire-and-forget "product speaking" WhatsApp — never block opt-in on
        // send failure. This is the customer's first-ever WhatsApp message from
        // us, so it's business-initiated and needs the approved Content
        // Template `tag_product_scan` (header = product photo, body var 2 =
        // product name). Without TWILIO_TEMPLATE_BARCODE_SCAN_SID we fall back
        // to freeform, which WhatsApp silently drops outside the 24h window —
        // so every outcome is now recorded on notification_history.
        try {
          const { sendWhatsApp } = await import("@/lib/whatsapp.server");
          const contentSid = process.env.TWILIO_TEMPLATE_BARCODE_SCAN_SID;
          const fallbackBody =
            `Hey, I'm the ${productName} you just scanned 😉 I'm still available and I'll keep you ` +
            `updated if anything changes — like a price drop, someone else showing interest, or if I ` +
            `become the last one available.`;

          const result = contentSid
            ? await sendWhatsApp({
                to: e164,
                contentSid,
                contentVariables: {
                  "1": productImage,
                  "2": productName,
                },
              })
            : await sendWhatsApp({
                to: e164,
                body: fallbackBody,
                mediaUrl: productImage || null,
              });

          if (!result.ok) {
            console.warn("[scan.barcode-interest] whatsapp send failed", result.status, result.error);
          }

          await supabaseAdmin.from("notification_history").insert({
            retailer_id: (product as any).retailer_id,
            customer_id: customerId,
            channel: "whatsapp",
            payload: {
              type: "barcode_scan",
              product_id: (product as any).id,
              template: contentSid ? "tag_product_scan" : null,
              body: contentSid ? null : fallbackBody,
            },
            status: result.ok ? "sent" : "failed",
            sent_at: result.ok ? new Date().toISOString() : null,
            error: result.ok
              ? null
              : contentSid
                ? result.error
                : `${result.error ?? "send failed"} (no TWILIO_TEMPLATE_BARCODE_SCAN_SID configured — freeform sends are blocked outside the 24h window)`,
            provider_message_sid: result.sid ?? null,
          });
        } catch (e: any) {
          console.warn("[scan.barcode-interest] whatsapp send error", e?.message ?? e);
        }


        return jsonRes({ ok: true, customerId });
      },
    },
  },
});
