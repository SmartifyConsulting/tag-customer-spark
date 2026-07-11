import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProductIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: product }, { data: signals }, { data: forecast }, { data: history }] = await Promise.all([
      context.supabase.from("products")
        .select("id,name,intent_score,intent_score_confidence,intent_score_trend,intent_score_updated_at,price_cents,sale_price_cents,stock_qty,low_stock_threshold")
        .eq("id", data.product_id).maybeSingle(),
      context.supabase.from("product_intent_signals").select("*").eq("product_id", data.product_id).maybeSingle(),
      context.supabase.from("product_intent_forecast").select("*").eq("product_id", data.product_id).maybeSingle(),
      context.supabase.from("product_intent_history").select("snapshot_date,intent_score").eq("product_id", data.product_id).order("snapshot_date", { ascending: true }).limit(60),
    ]);
    return { product, signals, forecast, history: history ?? [] };
  });

function avg(rows: any[], key: string): number {
  if (!rows.length) return 0;
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0) / rows.length;
}
function sum(rows: any[], key: string): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}
function majorityTrend(values: string[], options: readonly string[], fallback: string): string {
  if (!values.length) return fallback;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = fallback;
  let bestCount = -1;
  for (const opt of options) {
    const c = counts.get(opt) ?? 0;
    if (c > bestCount) {
      best = opt;
      bestCount = c;
    }
  }
  return best;
}

// Retailer-wide rollup of the same shape getProductIntent returns, so the
// UI can render one aggregated "Intent Score" card at the top of Insights.
export const getRetailerIntentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles").select("retailer_id")
      .eq("user_id", userId).not("retailer_id", "is", null).limit(1).maybeSingle();
    const retailerId = role?.retailer_id;
    if (!retailerId) return null;

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [{ data: products }, { data: signalRows }, { data: forecastRows }, { data: historyRows }] =
      await Promise.all([
        supabase.from("products")
          .select("intent_score,intent_score_confidence,intent_score_trend,stock_qty,low_stock_threshold")
          .eq("retailer_id", retailerId).neq("status", "archived"),
        supabase.from("product_intent_signals").select("*").eq("retailer_id", retailerId),
        supabase.from("product_intent_forecast").select("*").eq("retailer_id", retailerId),
        supabase.from("product_intent_history").select("snapshot_date,intent_score")
          .eq("retailer_id", retailerId).gte("snapshot_date", sixtyDaysAgo),
      ]);

    const prods = products ?? [];
    const rising = prods.filter((p: any) => p.intent_score_trend === "rising").length;
    const falling = prods.filter((p: any) => p.intent_score_trend === "falling").length;
    const trend = majorityTrend(
      prods.map((p: any) => p.intent_score_trend),
      ["rising", "falling", "stable"],
      "stable",
    );

    const sig = signalRows ?? [];
    const fc = forecastRows ?? [];

    const byDate = new Map<string, { sum: number; count: number }>();
    for (const h of historyRows ?? []) {
      const cur = byDate.get(h.snapshot_date) ?? { sum: 0, count: 0 };
      cur.sum += Number(h.intent_score);
      cur.count += 1;
      byDate.set(h.snapshot_date, cur);
    }
    const history = Array.from(byDate.entries())
      .map(([snapshot_date, v]) => ({ snapshot_date, intent_score: v.sum / v.count }))
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

    const lowStockCount = prods.filter(
      (p: any) => Number(p.stock_qty ?? 0) <= Number(p.low_stock_threshold ?? 0),
    ).length;

    return {
      productCount: prods.length,
      risingCount: rising,
      fallingCount: falling,
      lowStockCount,
      overview: {
        intent_score: avg(prods, "intent_score"),
        intent_score_confidence: avg(prods, "intent_score_confidence"),
        intent_score_trend: trend,
      },
      signals: {
        scans_total: sum(sig, "scans_total"),
        repeat_scans: sum(sig, "repeat_scans"),
        avg_time_on_page_seconds: avg(sig, "avg_time_on_page_seconds"),
        viewers: sum(sig, "viewers"),
        watchlist_adds: sum(sig, "watchlist_adds"),
        notif_engagement: sum(sig, "notif_engagement"),
        conversion_rate: avg(sig, "conversion_rate"),
        add_to_cart_rate: avg(sig, "add_to_cart_rate"),
        price_impact: avg(sig, "price_impact"),
      },
      forecast: fc.length
        ? {
            predicted_score_7d: avg(fc, "predicted_score_7d"),
            predicted_score_14d: avg(fc, "predicted_score_14d"),
            predicted_trend: majorityTrend(
              fc.map((f: any) => f.predicted_trend),
              ["increase", "decrease", "stable"],
              "stable",
            ),
          }
        : null,
      history,
    };
  });

export const listIntentSections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: products } = await context.supabase
      .from("products")
      .select("id,name,image_url,intent_score,intent_score_trend,intent_score_confidence,stock_qty");
    const { data: signals } = await context.supabase
      .from("product_intent_signals")
      .select("product_id,conversion_rate,scans_total");

    const sigMap = new Map((signals ?? []).map((s: any) => [s.product_id, s]));
    const enriched = (products ?? []).map((p: any) => ({
      ...p,
      conversion_rate: sigMap.get(p.id)?.conversion_rate ?? 0,
      scans_total: sigMap.get(p.id)?.scans_total ?? 0,
    }));

    const high = [...enriched].filter((p) => Number(p.intent_score) > 75).sort((a, b) => b.intent_score - a.intent_score).slice(0, 6);
    const rising = [...enriched].filter((p) => p.intent_score_trend === "rising").sort((a, b) => b.intent_score - a.intent_score).slice(0, 6);
    const gap = [...enriched].filter((p) => Number(p.intent_score) > 60 && Number(p.conversion_rate) < 0.02).sort((a, b) => b.intent_score - a.intent_score).slice(0, 6);

    return { high, rising, gap };
  });

export const getIntentWeights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("retailer_id")
      .eq("user_id", context.userId).not("retailer_id", "is", null).limit(1).maybeSingle();
    if (!role?.retailer_id) return null;
    const { data } = await context.supabase
      .from("intent_score_weights").select("*").eq("retailer_id", role.retailer_id).maybeSingle();
    return data;
  });

export const updateIntentWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      w_scans: z.number().min(0).max(1),
      w_repeat: z.number().min(0).max(1),
      w_time: z.number().min(0).max(1),
      w_viewers: z.number().min(0).max(1),
      w_watchlist: z.number().min(0).max(1),
      w_notif: z.number().min(0).max(1),
      w_conversion: z.number().min(0).max(1),
      w_cart: z.number().min(0).max(1),
      w_price: z.number().min(0).max(1),
      forecast_sensitivity: z.enum(["conservative","balanced","aggressive"]),
      forecasting_enabled: z.boolean(),
      update_frequency_minutes: z.number().int().min(1).max(60),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("retailer_id")
      .eq("user_id", context.userId).not("retailer_id", "is", null).limit(1).maybeSingle();
    if (!role?.retailer_id) throw new Error("No retailer assigned");
    const { error } = await context.supabase
      .from("intent_score_weights")
      .upsert({ retailer_id: role.retailer_id, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recomputeProductIntentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.rpc("recompute_product_intent", { _product_id: data.product_id });
    await context.supabase.rpc("forecast_product_intent", { _product_id: data.product_id });
    return { ok: true };
  });
