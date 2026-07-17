import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rangeSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

function startDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const getAdvancedAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = startDate(data.days);
    const sinceIso = since.toISOString();

    const [
      { data: scans },
      { data: customers },
      { data: recoveries },
      { data: history },
      { data: campaigns },
      { data: products },
      { data: stores },
    ] = await Promise.all([
      supabase
        .from("qr_scans")
        .select("id, scanned_at, customer_id, product_id, store_id, device_type")
        .gte("scanned_at", sinceIso),
      supabase.from("customers").select("id, created_at, opted_in_at"),
      supabase
        .from("sales_recoveries")
        .select("amount_cents, currency, recovered_at, notification_id, customer_id, product_id, created_at")
        .gte("recovered_at", sinceIso),
      supabase
        .from("notification_history")
        .select("status, sent_at, delivered_at, read_at, clicked_at, redeemed_at, campaign_id, customer_id, created_at")
        .gte("created_at", sinceIso),
      supabase
        .from("notification_campaigns")
        .select("id, title, type, status, audience_size, sent_at, created_at"),
      supabase.from("products").select("id, name, image_url"),
      supabase.from("stores").select("id, name"),
    ]);

    const productMap = new Map((products ?? []).map((p) => [p.id, p]));
    const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));
    const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c]));

    const totalScans = scans?.length ?? 0;
    const uniqueCustomers = new Set((scans ?? []).filter((s) => s.customer_id).map((s) => s.customer_id)).size;

    const customerScanCounts = new Map<string, number>();
    (scans ?? []).forEach((s) => {
      if (!s.customer_id) return;
      customerScanCounts.set(s.customer_id, (customerScanCounts.get(s.customer_id) ?? 0) + 1);
    });
    const returningCustomers = Array.from(customerScanCounts.values()).filter((v) => v > 1).length;

    // popular products
    const productCounts = new Map<string, number>();
    (scans ?? []).forEach((s) => {
      productCounts.set(s.product_id, (productCounts.get(s.product_id) ?? 0) + 1);
    });
    const popularProducts = Array.from(productCounts.entries())
      .map(([id, count]) => ({ id, count, product: productMap.get(id) ?? null }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // popular stores
    const storeCounts = new Map<string, number>();
    (scans ?? []).forEach((s) => {
      if (!s.store_id) return;
      storeCounts.set(s.store_id, (storeCounts.get(s.store_id) ?? 0) + 1);
    });
    const popularStores = Array.from(storeCounts.entries())
      .map(([id, count]) => ({ id, count, store: storeMap.get(id) ?? null }))
      .sort((a, b) => b.count - a.count);

    // recovered revenue
    const recoveredCents = (recoveries ?? []).reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
    const currency = recoveries?.[0]?.currency ?? "USD";

    // avg recovery time (notification.sent_at -> recovery.recovered_at)
    let recoveryTimes: number[] = [];
    for (const r of recoveries ?? []) {
      if (!r.notification_id) continue;
      const { data: notif } = await supabase
        .from("notification_history")
        .select("sent_at")
        .eq("id", r.notification_id)
        .maybeSingle();
      if (notif?.sent_at) {
        recoveryTimes.push(new Date(r.recovered_at).getTime() - new Date(notif.sent_at).getTime());
      }
    }
    const avgRecoveryMs = recoveryTimes.length
      ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
      : 0;

    // notification CTR per campaign
    const campaignStats = new Map<
      string,
      { sent: number; delivered: number; read: number; clicked: number; redeemed: number }
    >();
    (history ?? []).forEach((h) => {
      if (!h.campaign_id) return;
      const s = campaignStats.get(h.campaign_id) ?? { sent: 0, delivered: 0, read: 0, clicked: 0, redeemed: 0 };
      if (h.sent_at) s.sent += 1;
      if (h.delivered_at) s.delivered += 1;
      if (h.read_at) s.read += 1;
      if (h.clicked_at) s.clicked += 1;
      if (h.redeemed_at) s.redeemed += 1;
      campaignStats.set(h.campaign_id, s);
    });
    const campaignPerformance = Array.from(campaignStats.entries()).map(([id, s]) => {
      const c = campaignMap.get(id);
      return {
        id,
        title: c?.title ?? "Untitled",
        type: c?.type ?? "custom",
        sent: s.sent,
        delivered: s.delivered,
        read: s.read,
        clicked: s.clicked,
        redeemed: s.redeemed,
        ctr: s.delivered ? Math.round((s.clicked / s.delivered) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.sent - a.sent);

    const totalSent = campaignPerformance.reduce((s, r) => s + r.sent, 0);
    const totalClicked = campaignPerformance.reduce((s, r) => s + r.clicked, 0);
    const overallCtr = totalSent ? Math.round((totalClicked / totalSent) * 1000) / 10 : 0;

    // Customer growth time series
    const customerGrowth: { date: string; total: number; new: number }[] = [];
    const dayMs = 86_400_000;
    const sorted = (customers ?? [])
      .map((c) => new Date(c.created_at).getTime())
      .sort((a, b) => a - b);
    for (let i = 0; i < data.days; i++) {
      const d = new Date(since.getTime() + i * dayMs);
      const next = d.getTime() + dayMs;
      const newCount = sorted.filter((t) => t >= d.getTime() && t < next).length;
      const total = sorted.filter((t) => t < next).length;
      customerGrowth.push({
        date: d.toISOString().slice(0, 10),
        total,
        new: newCount,
      });
    }

    // Trend: daily scans
    const scanTrend: { date: string; scans: number }[] = [];
    for (let i = 0; i < data.days; i++) {
      const d = new Date(since.getTime() + i * dayMs);
      const next = d.getTime() + dayMs;
      const count = (scans ?? []).filter((s) => {
        const t = new Date(s.scanned_at).getTime();
        return t >= d.getTime() && t < next;
      }).length;
      scanTrend.push({ date: d.toISOString().slice(0, 10), scans: count });
    }

    // Heatmap: weekday (0-6) x hour (0-23)
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    (scans ?? []).forEach((s) => {
      const d = new Date(s.scanned_at);
      heatmap[d.getDay()][d.getHours()] += 1;
    });

    // % change in the total customer base across the selected window —
    // customerGrowth[i].total is already a running cumulative count, so the
    // first and last entries bookend the range without a second query.
    const customersTotal = customers?.length ?? 0;
    const rangeStartTotal = customerGrowth[0]?.total ?? 0;
    const customersPctChange =
      rangeStartTotal > 0
        ? ((customersTotal - rangeStartTotal) / rangeStartTotal) * 100
        : customersTotal > 0
          ? 100
          : 0;

    return {
      range: { days: data.days, since: sinceIso },
      totals: {
        totalScans,
        uniqueCustomers,
        returningCustomers,
        recoveredCents,
        currency,
        avgRecoveryHours: avgRecoveryMs / 3_600_000,
        overallCtr,
        customersTotal,
        customersPctChange,
      },
      popularProducts,
      popularStores,
      campaignPerformance,
      customerGrowth,
      scanTrend,
      heatmap,
    };
  });

export type AdvancedAnalytics = Awaited<ReturnType<typeof getAdvancedAnalytics>>;
