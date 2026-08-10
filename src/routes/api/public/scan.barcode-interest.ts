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

        // Tapping "Follow Me" after entering the number IS the opt-in, so the
        // watch goes live immediately. Alerts are measured from this snapshot.
        const { data: watchedProduct } = await supabaseAdmin
          .from("products")
          .select("price_cents, sale_price_cents, stock_qty, intent_score")
          .eq("id", (product as any).id)
          .maybeSingle();

        const { createOrRefreshWatch } = await import("@/lib/watch-repository.server");
        try {
          await createOrRefreshWatch(supabaseAdmin, {
            retailerId: (product as any).retailer_id,
            customerId,
            productId: (product as any).id,
            whatsappNumber: e164,
            active: true,
            product: (watchedProduct as any) ?? {
              price_cents: null,
              sale_price_cents: null,
              stock_qty: 0,
              intent_score: 0,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not activate product alerts";
          console.error("[scan.barcode-interest] watch activation failed", message);
          return jsonRes({ ok: false, error: "We saved your details but could not activate product alerts. Please try again." }, 500);
        }



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
            // Customer-originated: never an internal staff note.
            is_internal: false,
            status: "delivered",
            sent_at: now,
          });
        }

        // Confirmation WhatsApp. The customer has already opted in on the web
        // page, so this only confirms it. The template is configurable in
        // Settings > Automations (default `tag_scan_v5`) and is built from its
        // approved contract — IMAGE header on a public https URL.
        // Never block the opt-in on a send failure; record every outcome.
        let deliveryError: string | null = null;
        let scanTemplate = "tag_scan_v5";
        try {
          const { sendTemplate } = await import("@/lib/whatsapp-service.server");
          const { isPublicMediaUrl } = await import("@/lib/whatsapp-templates.server");
          const { getScanConfirmationSetting } = await import("@/lib/automation.server");
          const { buildScanTemplateVariables } = await import("@/lib/scan-template.server");

          const scanSetting = await getScanConfirmationSetting(
            supabaseAdmin,
            (product as any).retailer_id,
          );
          scanTemplate = scanSetting.templateName;
          if (!scanSetting.enabled) throw new SkipConfirmation();

          let headerImage = isPublicMediaUrl(productImage) ? productImage : null;
          if (!headerImage) {
            const { data: retailer } = await supabaseAdmin
              .from("retailers")
              .select("logo_url")
              .eq("id", (product as any).retailer_id)
              .maybeSingle();
            const logo = (retailer as any)?.logo_url ?? null;
            headerImage = isPublicMediaUrl(logo) ? logo : null;
          }

          const historyBody =
            `Confirmed watch on ${productName}. We'll message you about price changes, ` +
            `other interest, and the last unit.`;

          const result = await sendTemplate({
            templateName: scanTemplate,
            to: e164,
            headerImageUrl: headerImage,
            variables: buildScanTemplateVariables({
              productName,
              priceCents:
                (watchedProduct as any)?.sale_price_cents ?? (watchedProduct as any)?.price_cents ?? null,
              originalPriceCents: (watchedProduct as any)?.price_cents ?? null,
            }),
          });

          if (!result.ok) {
            console.warn("[scan.barcode-interest] whatsapp send failed", result.status, result.error);
            deliveryError = result.error ?? "WhatsApp confirmation was rejected";
          }

          await supabaseAdmin.from("notification_history").insert({
            retailer_id: (product as any).retailer_id,
            customer_id: customerId,
            channel: "whatsapp",
            payload: {
              type: "barcode_scan",
              product_id: (product as any).id,
              template: scanTemplate,
              body: historyBody,
              // Safe, non-secret evidence of WHICH credential binding this
              // runtime used. The public route and the authenticated dashboard
              // test are served by different execution contexts, so this is
              // the only way to prove they share the same current credential.
              delivery_diagnostic: result.diagnostic ?? null,
            },


            // Provider acceptance is not delivery — the Infobip webhook
            // promotes this to delivered/read or marks it failed.
            status: result.ok ? "queued" : "failed",
            sent_at: result.ok ? new Date().toISOString() : null,
            error: result.ok ? null : result.error,
            provider_message_sid: result.sid ?? null,
          });


        } catch (e: any) {
          console.warn("[scan.barcode-interest] whatsapp send error", e?.message ?? e);
          deliveryError = e?.message ?? "WhatsApp confirmation could not be sent";
        }

        return jsonRes({
          ok: true,
          customerId,
          confirmationSent: !deliveryError,
          warning: deliveryError ? "Your alerts are active, but the confirmation WhatsApp could not be sent yet." : null,
        });
      },
    },
  },
});
