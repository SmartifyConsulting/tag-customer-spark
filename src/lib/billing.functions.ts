import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, priceCents, type PlanId, type Cycle } from "./billing/pricing";

/**
 * Resolve the caller's active retailer + role. Only retail_admin / super_admin
 * may initiate billing actions.
 */
async function requireBillingContext(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => Promise<{ data: Array<{ role: string; retailer_id: string | null }> | null }> } } },
  userId: string,
) {
  const { data: rolesRow } = await supabase
    .from("user_roles")
    .select("role, retailer_id")
    .eq("user_id", userId);
  const roles = rolesRow ?? [];
  const superAdmin = roles.some((r) => r.role === "super_admin");
  const adminRow = roles.find(
    (r) => (r.role === "retail_admin" || r.role === "store_manager") && r.retailer_id,
  );
  const retailerId = adminRow?.retailer_id ?? undefined;
  if (!retailerId && !superAdmin) {
    throw new Error("Only retail admins can manage billing.");
  }
  if (!retailerId) throw new Error("No retailer selected.");
  return { retailerId, superAdmin };
}

const CheckoutInput = z.object({
  plan: z.enum(["pro", "enterprise"]),
  cycle: z.enum(["monthly", "annual"]),
  return_url: z.string().url(),
  cancel_url: z.string().url(),
  notify_url: z.string().url(),
});

// ---------- PayFast: create checkout ----------
export const createPayfastCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => CheckoutInput.parse(v))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { retailerId } = await requireBillingContext(supabase as never, userId);

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const passphrase = process.env.PAYFAST_PASSPHRASE || "";
    if (!merchantId || !merchantKey) {
      throw new Error("PayFast is not yet configured. Add PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY.");
    }

    const { PAYFAST_PROCESS_URL, buildPfSignature } = await import("./billing/payfast.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const mPaymentId = crypto.randomUUID();
    const amountCents = priceCents(data.plan as PlanId, data.cycle as Cycle, "ZAR");
    if (amountCents <= 0) throw new Error("Contact sales for this plan.");
    const amountDecimal = (amountCents / 100).toFixed(2);

    const { data: retailer } = await supabaseAdmin
      .from("retailers").select("name, billing_email, contact_email").eq("id", retailerId).maybeSingle();

    const { error: insErr } = await supabaseAdmin.from("payment_purchases").insert({
      retailer_id: retailerId,
      user_id: userId,
      provider: "payfast",
      provider_order_id: mPaymentId,
      plan: data.plan,
      billing_cycle: data.cycle,
      amount_cents: amountCents,
      currency: "ZAR",
      status: "pending",
    });
    if (insErr) throw new Error(`Could not create purchase: ${insErr.message}`);

    const fields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: data.return_url,
      cancel_url: data.cancel_url,
      notify_url: data.notify_url,
      email_address: retailer?.billing_email || retailer?.contact_email || "",
      m_payment_id: mPaymentId,
      amount: amountDecimal,
      item_name: `Tag ${PLANS[data.plan as PlanId].name} · ${data.cycle}`,
      custom_str1: retailerId,
      custom_str2: data.plan,
      custom_str3: data.cycle,
    };
    const signature = buildPfSignature(fields, passphrase);
    const all = { ...fields, signature };
    const qs = Object.entries(all)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    return { redirect_url: `${PAYFAST_PROCESS_URL}?${qs}`, m_payment_id: mPaymentId };
  });

// ---------- PayPal: create order ----------
const PaypalOrderInput = z.object({
  plan: z.enum(["pro", "enterprise"]),
  cycle: z.enum(["monthly", "annual"]),
  return_url: z.string().url(),
  cancel_url: z.string().url(),
});

export const createPaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => PaypalOrderInput.parse(v))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { retailerId } = await requireBillingContext(supabase as never, userId);

    const { PAYPAL_BASE, getPayPalToken } = await import("./billing/paypal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const amountCents = priceCents(data.plan as PlanId, data.cycle as Cycle, "USD");
    if (amountCents <= 0) throw new Error("Contact sales for this plan.");
    const valueDecimal = (amountCents / 100).toFixed(2);

    const token = await getPayPalToken();
    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: valueDecimal },
          description: `Tag ${PLANS[data.plan as PlanId].name} · ${data.cycle}`,
          custom_id: `${retailerId}|${data.plan}|${data.cycle}`,
        }],
        application_context: {
          brand_name: "Tag",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          landing_page: "LOGIN",
          return_url: data.return_url,
          cancel_url: data.cancel_url,
        },
      }),
    });
    if (!res.ok) throw new Error(`PayPal order failed: ${await res.text()}`);
    const order = await res.json() as { id: string; links?: Array<{ rel: string; href: string }> };
    const approveUrl = (order.links ?? []).find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ?? null;

    await supabaseAdmin.from("payment_purchases").insert({
      retailer_id: retailerId,
      user_id: userId,
      provider: "paypal",
      provider_order_id: order.id,
      plan: data.plan,
      billing_cycle: data.cycle,
      amount_cents: amountCents,
      currency: "USD",
      status: "pending",
    });
    return { order_id: order.id, approve_url: approveUrl };
  });

// ---------- PayPal: capture order ----------
export const capturePaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ order_id: z.string().min(1) }).parse(v))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { PAYPAL_BASE, getPayPalToken } = await import("./billing/paypal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { grantTier, logBillingEvent } = await import("./billing/grant.server");

    const { data: purchase } = await supabaseAdmin
      .from("payment_purchases")
      .select("*")
      .eq("provider_order_id", data.order_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.status === "completed") return { ok: true, already: true };

    const token = await getPayPalToken();
    const capRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${data.order_id}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const capJson = await capRes.json() as { status?: string; purchase_units?: unknown[] };
    if (!capRes.ok || capJson.status !== "COMPLETED") {
      await supabaseAdmin.from("payment_purchases").update({ status: "failed" }).eq("id", purchase.id);
      await logBillingEvent(purchase.retailer_id, "paypal", "capture.failed", capJson, false);
      throw new Error("PayPal capture failed");
    }

    await supabaseAdmin.from("payment_purchases")
      .update({ status: "completed", raw: capJson as never })
      .eq("id", purchase.id);

    await grantTier(
      purchase.retailer_id,
      purchase.plan as PlanId,
      purchase.billing_cycle as Cycle,
      "paypal",
      data.order_id,
    );
    await logBillingEvent(purchase.retailer_id, "paypal", "capture.completed", capJson, true);
    return { ok: true };
  });

// ---------- User: my subscription + invoices ----------
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("retailer_id").eq("user_id", userId);
    const retailerId = (roles ?? []).find((r: { retailer_id: string | null }) => r.retailer_id)?.retailer_id as string | undefined;
    if (!retailerId) return { retailer: null, subscription: null, purchases: [] };
    const [{ data: retailer }, { data: sub }, { data: purchases }] = await Promise.all([
      supabase.from("retailers").select("id, name, tier, billing_email, contact_email").eq("id", retailerId).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("retailer_id", retailerId).maybeSingle(),
      supabase.from("payment_purchases").select("*").eq("retailer_id", retailerId).order("created_at", { ascending: false }).limit(20),
    ]);
    return { retailer, subscription: sub, purchases: purchases ?? [] };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { retailerId } = await requireBillingContext(supabase as never, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions")
      .update({ cancel_at_period_end: true, updated_by: userId })
      .eq("retailer_id", retailerId);
    return { ok: true };
  });

// ---------- User: change plan (up/down) without provider round-trip ----------
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        tier: z.enum(["starter", "pro", "enterprise"]),
        cycle: z.enum(["monthly", "annual"]).default("monthly"),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { retailerId } = await requireBillingContext(supabase as never, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, provider, billing_cycle, status")
      .eq("retailer_id", retailerId)
      .maybeSingle();

    if (data.tier === "starter") {
      // Downgrade: keep access until period end if paying; otherwise flip immediately.
      if (sub && sub.status === "active") {
        await supabaseAdmin
          .from("subscriptions")
          .update({ cancel_at_period_end: true, updated_by: userId })
          .eq("retailer_id", retailerId);
      } else {
        await supabaseAdmin.from("retailers").update({ tier: "starter" }).eq("id", retailerId);
      }
      await supabaseAdmin.from("audit_logs").insert({
        retailer_id: retailerId,
        actor_user_id: userId,
        action: "billing.change_plan",
        entity_type: "subscription",
        status: "success",
        metadata: { tier: "starter" } as never,
      });
      return { ok: true, provider_redirect: false };
    }

    // Upgrade/switch to paid plan.
    if (sub && sub.status === "active" && sub.provider) {
      // Same-provider tier switch (no re-checkout).
      const { grantTier } = await import("./billing/grant.server");
      await grantTier(retailerId, data.tier, data.cycle, sub.provider as "payfast" | "paypal", null);
      await supabaseAdmin.from("audit_logs").insert({
        retailer_id: retailerId,
        actor_id: userId,
        action: "billing.change_plan",
        entity_type: "subscription",
        status: "success",
        payload: { tier: data.tier, cycle: data.cycle, provider: sub.provider } as never,
      });
      return { ok: true, provider_redirect: false };
    }

    // No active subscription — caller must go through PayFast/PayPal.
    return { ok: false, provider_redirect: true };
  });


// ---------- Super-admin: plan admin dashboard ----------
export const adminListSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("retailers")
      .select("id, name, tier, contact_email, billing_email, subscriptions(plan, status, provider, billing_cycle, current_period_end, cancel_at_period_end)")
      .order("name");
    return data ?? [];
  });

export const adminSetTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      retailer_id: z.string().uuid(),
      tier: z.enum(["starter", "pro", "enterprise"]),
      cycle: z.enum(["monthly", "annual"]).default("monthly"),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.tier === "starter") {
      await supabaseAdmin.from("retailers").update({ tier: "starter" }).eq("id", data.retailer_id);
      await supabaseAdmin.from("subscriptions").update({ status: "cancelled", cancel_at_period_end: true }).eq("retailer_id", data.retailer_id);
      return { ok: true };
    }
    const { grantTier } = await import("./billing/grant.server");
    await grantTier(data.retailer_id, data.tier, data.cycle, "payfast", `manual-${Date.now()}`);
    return { ok: true };
  });
