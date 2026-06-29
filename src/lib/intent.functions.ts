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
