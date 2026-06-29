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
          .select("id, product_id, retailer_id, store_id, is_active")
          .eq("short_code", parsed.shortCode)
          .maybeSingle();

        if (!tag || !tag.is_active) {
          return jsonRes({ ok: false, error: "Tag not found" }, 404);
        }

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

        // Open or refresh conversation
        const { data: convo } = await supabaseAdmin
          .from("conversations")
          .select("id")
          .eq("customer_id", customerId)
          .eq("retailer_id", tag.retailer_id)
          .maybeSingle();
        if (!convo) {
          await supabaseAdmin.from("conversations").insert({
            customer_id: customerId,
            retailer_id: tag.retailer_id,
            store_id: tag.store_id,
            status: "open",
            subject: "Opted in via QR scan",
          });
        }

        return jsonRes({ ok: true, customerId });
      },
    },
  },
});
