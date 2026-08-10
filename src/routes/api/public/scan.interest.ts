import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";

const interestSchema = z.object({
  shortCode: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  whatsapp: z.string().min(5).max(40),
  notifyConsent: z.literal(true),
  marketingConsent: z.boolean().optional().default(false),
  privacyAccepted: z.boolean().optional().default(false),
});

/** Thrown when the retailer has switched the scan confirmation off. */
class SkipConfirmation extends Error {}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/scan/interest")({
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

        if (!isValidPhoneNumber(parsed.whatsapp)) {
          return jsonRes({ ok: false, error: "Invalid phone number" }, 400);
        }
        const phone = parsePhoneNumber(parsed.whatsapp);
        const e164 = phone.number;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: tag } = await supabaseAdmin
          .from("qr_tags")
          .select("id, product_id, retailer_id, store_id, is_active, product:products(name, thumbnail_url, image_url), retailer:retailers(name, logo_url)")
          .eq("short_code", parsed.shortCode)
          .maybeSingle();

        if (!tag || !tag.is_active) {
          return jsonRes({ ok: false, error: "Tag not found" }, 404);
        }

        const productName = (tag as any).product?.name ?? "this product";
        const retailerName = (tag as any).retailer?.name ?? "the store";
        const retailerLogo = (tag as any).retailer?.logo_url ?? "";

        const now = new Date().toISOString();

        // Upsert customer on (retailer_id, whatsapp_e164)
        const { data: existing } = await supabaseAdmin
          .from("customers")
          .select("id, marketing_consent_at, privacy_accepted_at")
          .eq("retailer_id", tag.retailer_id)
          .eq("whatsapp_e164", e164)
          .maybeSingle();

        let customerId: string;
        if (existing) {
          const patch: any = {
            full_name: parsed.name,
            notify_consent_at: now,
            status: "subscribed",
          };
          if (parsed.marketingConsent && !existing.marketing_consent_at)
            patch.marketing_consent_at = now;
          if (parsed.privacyAccepted && !existing.privacy_accepted_at)
            patch.privacy_accepted_at = now;
          await supabaseAdmin.from("customers").update(patch).eq("id", existing.id);

          customerId = existing.id as string;
        } else {
          const { data: ins, error: insErr } = await supabaseAdmin
            .from("customers")
            .insert({
              retailer_id: tag.retailer_id,
              whatsapp_e164: e164,
              full_name: parsed.name,
              opted_in_at: now,
              notify_consent_at: now,
              marketing_consent_at: parsed.marketingConsent ? now : null,
              privacy_accepted_at: parsed.privacyAccepted ? now : null,
              status: "subscribed",
              source: "scan",
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
          .eq("product_id", tag.product_id)
          .maybeSingle();

        if (!existingInterest) {
          await supabaseAdmin.from("customer_interests").insert({
            customer_id: customerId,
            product_id: tag.product_id,
            qr_tag_id: tag.id,
            retailer_id: tag.retailer_id,
            status: "active",
            source: "scan",
          });
        } else {
          await supabaseAdmin
            .from("customer_interests")
            .update({ status: "active" })
            .eq("id", existingInterest.id);
        }

        // Watch this product for price/stock changes — "I'm interested" means
        // "notify me of any update". Snapshots the current price/stock so the
        // Notification Engine measures changes from this moment.
        const { data: watchedProduct } = await supabaseAdmin
          .from("products")
          .select("price_cents, sale_price_cents, stock_qty, intent_score")
          .eq("id", tag.product_id)
          .maybeSingle();

        const { createOrRefreshWatch } = await import("@/lib/watch-repository.server");
        try {
          await createOrRefreshWatch(supabaseAdmin, {
            retailerId: tag.retailer_id as string,
            customerId,
            productId: tag.product_id as string,
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
          console.error("[scan.interest] watch activation failed", message);
          return jsonRes({ ok: false, error: "We saved your details but could not activate product alerts. Please try again." }, 500);
        }

        // Open or refresh the conversation, carrying the scanned product into
        // the Inbox thread (subject + first inbound message).
        let storeName: string | null = null;
        if (tag.store_id) {
          const { data: store } = await supabaseAdmin
            .from("stores")
            .select("name")
            .eq("id", tag.store_id)
            .maybeSingle();
          storeName = (store as any)?.name ?? null;
        }

        const subject = `Interested in ${productName}`;
        const scanLine =
          `📷 Scanned ${productName}` +
          (storeName ? ` at ${storeName}` : "") +
          ` and asked to be notified on WhatsApp.`;

        const { data: convo } = await supabaseAdmin
          .from("conversations")
          .select("id, tags")
          .eq("customer_id", customerId)
          .eq("retailer_id", tag.retailer_id)
          .maybeSingle();

        let conversationId = (convo as any)?.id as string | undefined;
        if (!conversationId) {
          const { data: newConvo } = await supabaseAdmin
            .from("conversations")
            .insert({
              customer_id: customerId,
              retailer_id: tag.retailer_id,
              store_id: tag.store_id,
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
            retailer_id: tag.retailer_id,
            direction: "inbound",
            body: scanLine,
            // Customer-originated: never an internal staff note.
            is_internal: false,
            status: "delivered",
            sent_at: now,
          });
        }


        // Confirmation WhatsApp for the web opt-in. Business-initiated, so it
        // is built from the approved contract of whichever template is
        // configured in Settings > Automations (default `tag_scan_v5`).
        // Never block opt-in on a send failure.
        let deliveryError: string | null = null;
        let scanTemplate = "tag_scan_v5";
        try {
          const { sendTemplate } = await import("@/lib/whatsapp-service.server");
          const { isPublicMediaUrl } = await import("@/lib/whatsapp-templates.server");
          const { getScanConfirmationSetting } = await import("@/lib/automation.server");
          const { buildScanTemplateVariables } = await import("@/lib/scan-template.server");

          const scanSetting = await getScanConfirmationSetting(supabaseAdmin, tag.retailer_id);
          scanTemplate = scanSetting.templateName;
          if (!scanSetting.enabled) throw new SkipConfirmation();

          const headerImage =
            [
              (tag as any).product?.thumbnail_url,
              (tag as any).product?.image_url,
              retailerLogo,
            ].find((u: string | null) => isPublicMediaUrl(u)) ?? null;

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
            console.warn("[scan.interest] whatsapp send failed", result.status, result.error);
            deliveryError = result.error ?? "WhatsApp confirmation was rejected";
          }

          await supabaseAdmin.from("notification_history").insert({
            retailer_id: tag.retailer_id,
            customer_id: customerId,
            channel: "whatsapp",
            payload: {
              type: "qr_scan",
              product_id: tag.product_id,
              template: scanTemplate,
              body: `Confirmed watch on ${productName}.`,
              delivery_diagnostic: result.diagnostic ?? null,
            },
            status: result.ok ? "queued" : "failed",
            sent_at: result.ok ? new Date().toISOString() : null,
            error: result.ok ? null : deliveryError,
            provider_message_sid: result.sid ?? null,
          });
        } catch (e: any) {
          if (e instanceof SkipConfirmation) {
            // Confirmation intentionally switched off in Settings > Automations.
          } else {
            console.warn("[scan.interest] whatsapp send error", e?.message ?? e);
            deliveryError = e?.message ?? "WhatsApp confirmation could not be sent";
          }
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

