import { createFileRoute } from "@tanstack/react-router";

// PayPal webhook. Configure the webhook in the PayPal developer console pointing
// to https://<your-domain>/api/public/webhooks/paypal and set PAYPAL_WEBHOOK_ID.
export const Route = createFileRoute("/api/public/webhooks/paypal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { PAYPAL_BASE, getPayPalToken } = await import("@/lib/billing/paypal.server");
          const { grantTier, logBillingEvent } = await import("@/lib/billing/grant.server");

          const raw = await request.text();
          const payload = JSON.parse(raw);
          const webhookId = process.env.PAYPAL_WEBHOOK_ID;

          let signatureOk = false;
          if (webhookId) {
            const token = await getPayPalToken();
            const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                auth_algo: request.headers.get("paypal-auth-algo"),
                cert_url: request.headers.get("paypal-cert-url"),
                transmission_id: request.headers.get("paypal-transmission-id"),
                transmission_sig: request.headers.get("paypal-transmission-sig"),
                transmission_time: request.headers.get("paypal-transmission-time"),
                webhook_id: webhookId,
                webhook_event: payload,
              }),
            });
            const vJson = await verifyRes.json() as { verification_status?: string };
            signatureOk = vJson.verification_status === "SUCCESS";
            if (!signatureOk) {
              await logBillingEvent(null, "paypal", "webhook.signature_mismatch", payload, false);
              return new Response("Invalid signature", { status: 400 });
            }
          }

          const eventType = payload.event_type as string;
          if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
            const orderId =
              payload.resource?.supplementary_data?.related_ids?.order_id ??
              payload.resource?.id;
            const { data: purchase } = await supabaseAdmin
              .from("payment_purchases").select("*")
              .eq("provider", "paypal").eq("provider_order_id", orderId).maybeSingle();
            if (purchase && purchase.status !== "completed") {
              await supabaseAdmin.from("payment_purchases")
                .update({ status: "completed", raw: payload as never })
                .eq("id", purchase.id);
              await grantTier(
                purchase.retailer_id,
                purchase.plan as "pro" | "enterprise",
                purchase.billing_cycle as "monthly" | "annual",
                "paypal",
                orderId,
              );
            }
          }
          await logBillingEvent(null, "paypal", eventType, payload, signatureOk);
          return new Response("OK", { status: 200 });
        } catch (e) {
          console.error("paypal webhook error", e);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
