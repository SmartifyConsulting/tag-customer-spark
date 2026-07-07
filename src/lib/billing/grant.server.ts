import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { periodEnd, type Cycle, type PlanId } from "./pricing";

export async function grantTier(
  retailerId: string,
  plan: PlanId,
  cycle: Cycle,
  provider: "payfast" | "paypal",
  providerSubId: string | null = null,
) {
  if (plan === "enterprise") return; // enterprise handled offline by sales
  const pe = periodEnd(cycle).toISOString();
  const { error } = await supabaseAdmin.rpc("apply_paid_tier", {
    _retailer_id: retailerId,
    _tier: plan,
    _cycle: cycle,
    _period_end: pe,
    _provider: provider,
    _provider_sub_id: providerSubId ?? undefined,
  } as never);
  if (error) throw new Error(`apply_paid_tier failed: ${error.message}`);
}

export async function logBillingEvent(
  retailerId: string | null,
  provider: string,
  eventType: string,
  payload: unknown,
  signatureOk: boolean,
) {
  await supabaseAdmin.from("billing_events").insert({
    retailer_id: retailerId,
    provider,
    event_type: eventType,
    payload: payload as never,
    signature_ok: signatureOk,
  });
}
