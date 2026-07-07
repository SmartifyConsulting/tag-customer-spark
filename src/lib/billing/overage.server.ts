import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS, periodEnd, type Cycle, type PlanId } from "./pricing";

/** Ensure a usage counter row exists for the retailer's current period. */
export async function ensureUsageCounter(retailerId: string) {
  const { data: retailer } = await supabaseAdmin
    .from("retailers").select("tier").eq("id", retailerId).maybeSingle();
  const tier = (retailer?.tier ?? "starter") as PlanId;
  const plan = PLANS[tier];
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = periodEnd("monthly", start);

  const { data: existing } = await supabaseAdmin
    .from("notification_usage_counters")
    .select("*")
    .eq("retailer_id", retailerId)
    .eq("period_start", start.toISOString())
    .maybeSingle();
  if (existing) return existing as UsageRow;

  const { data: inserted } = await supabaseAdmin
    .from("notification_usage_counters")
    .insert({
      retailer_id: retailerId,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      included_count: plan.included_notifications,
      overage_rate_cents: plan.overage_cents_per_msg,
      currency: "ZAR",
    })
    .select()
    .single();
  return inserted as { id: string; included_count: number; sent_count: number; overage_cents_accrued: number; overage_rate_cents: number };
}

/** Increment sent_count and accrue overage where applicable. */
export async function incrementNotificationUsage(retailerId: string, count = 1) {
  const row = await ensureUsageCounter(retailerId);
  const newSent = row.sent_count + count;
  const over = Math.max(0, newSent - row.included_count) - Math.max(0, row.sent_count - row.included_count);
  const accrued = row.overage_cents_accrued + over * row.overage_rate_cents;
  await supabaseAdmin
    .from("notification_usage_counters")
    .update({ sent_count: newSent, overage_cents_accrued: accrued })
    .eq("id", row.id);
}

/** Return whether the retailer can send one more notification. */
export async function canSendNotification(retailerId: string): Promise<{ allowed: boolean; reason?: string }> {
  const { data: retailer } = await supabaseAdmin
    .from("retailers").select("tier").eq("id", retailerId).maybeSingle();
  const tier = (retailer?.tier ?? "starter") as PlanId;
  // Growth / Pro / Enterprise accrue overage; Go & Starter hard-cap.
  const hardCapTiers: PlanId[] = ["go", "starter"];
  const row = await ensureUsageCounter(retailerId);
  if (hardCapTiers.includes(tier) && row.sent_count >= row.included_count) {
    return { allowed: false, reason: `Notification quota reached (${row.included_count}/mo). Upgrade to keep sending.` };
  }
  return { allowed: true };
}

/** Cron: close periods that ended, create overage invoices. */
export async function rolloverUsagePeriods(nowIso = new Date().toISOString()) {
  const { data: expired } = await supabaseAdmin
    .from("notification_usage_counters")
    .select("id, retailer_id, period_start, period_end, sent_count, included_count, overage_cents_accrued, overage_rate_cents, currency")
    .lt("period_end", nowIso)
    .limit(200);
  const rows = expired ?? [];
  for (const r of rows) {
    const over = Math.max(0, (r.sent_count as number) - (r.included_count as number));
    if (over > 0 && (r.overage_cents_accrued as number) > 0) {
      const { data: existing } = await supabaseAdmin
        .from("notification_overage_invoices")
        .select("id")
        .eq("retailer_id", r.retailer_id)
        .eq("period_start", r.period_start)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("notification_overage_invoices").insert({
          retailer_id: r.retailer_id,
          period_start: r.period_start,
          period_end: r.period_end,
          msg_over: over,
          amount_cents: r.overage_cents_accrued,
          currency: r.currency ?? "ZAR",
          status: "pending",
        });
      }
    }
    // Immediately create next period counter.
    await ensureUsageCounter(r.retailer_id as string).catch(() => null);
  }
  return { closed: rows.length };
}

export function projectedOverageForCycle(_cycle: Cycle) {
  return null;
}
