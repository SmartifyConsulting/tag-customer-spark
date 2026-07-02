import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/payfast-itn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { buildPfSignature, PAYFAST_VALIDATE_URL } = await import("@/lib/billing/payfast.server");
          const { grantTier, logBillingEvent } = await import("@/lib/billing/grant.server");

          const raw = await request.text();
          const params = new URLSearchParams(raw);
          const fields: Record<string, string> = {};
          for (const [k, v] of params.entries()) fields[k] = v;

          const providedSig = fields.signature;
          if (!providedSig) return new Response("Missing signature", { status: 400 });

          const passphrase = process.env.PAYFAST_PASSPHRASE || "";
          const expected = buildPfSignature(fields, passphrase);
          if (expected !== providedSig) {
            await logBillingEvent(fields.custom_str1 || null, "payfast", "itn.signature_mismatch", fields, false);
            return new Response("Invalid signature", { status: 400 });
          }
          if (fields.merchant_id !== process.env.PAYFAST_MERCHANT_ID) {
            return new Response("Invalid merchant", { status: 400 });
          }

          const v = await fetch(PAYFAST_VALIDATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: raw,
          });
          const vText = (await v.text()).trim();
          if (!vText.startsWith("VALID")) {
            await logBillingEvent(fields.custom_str1 || null, "payfast", "itn.server_validate_failed", fields, false);
            return new Response("Validation failed", { status: 400 });
          }

          const mPaymentId = fields.m_payment_id;
          const { data: purchase } = await supabaseAdmin
            .from("payment_purchases")
            .select("*")
            .eq("provider_order_id", mPaymentId)
            .eq("provider", "payfast")
            .maybeSingle();
          if (!purchase) return new Response("OK", { status: 200 });
          if (purchase.status === "completed") return new Response("OK", { status: 200 });

          const amountGrossCents = Math.round(Number(fields.amount_gross) * 100);
          if (Math.abs(amountGrossCents - purchase.amount_cents) > 1) {
            await supabaseAdmin.from("payment_purchases").update({ status: "failed" }).eq("id", purchase.id);
            await logBillingEvent(purchase.retailer_id, "payfast", "itn.amount_mismatch", fields, true);
            return new Response("Amount mismatch", { status: 400 });
          }

          if (fields.payment_status !== "COMPLETE") {
            await supabaseAdmin.from("payment_purchases")
              .update({ status: (fields.payment_status || "failed").toLowerCase() })
              .eq("id", purchase.id).neq("status", "completed");
            await logBillingEvent(purchase.retailer_id, "payfast", `itn.${fields.payment_status}`, fields, true);
            return new Response("OK", { status: 200 });
          }

          const { data: claimed } = await supabaseAdmin
            .from("payment_purchases")
            .update({ status: "completed", raw: fields as never })
            .eq("id", purchase.id).neq("status", "completed")
            .select("id, retailer_id, plan, billing_cycle")
            .maybeSingle();
          if (!claimed) return new Response("OK", { status: 200 });

          await grantTier(
            claimed.retailer_id,
            claimed.plan as "pro" | "enterprise",
            claimed.billing_cycle as "monthly" | "annual",
            "payfast",
            fields.pf_payment_id ?? null,
          );
          await logBillingEvent(claimed.retailer_id, "payfast", "itn.completed", fields, true);
          return new Response("OK", { status: 200 });
        } catch (e) {
          console.error("payfast-itn error", e);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
