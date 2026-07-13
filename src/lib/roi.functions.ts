import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

export const getRoiOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(7).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) {
      return {
        kpis: { revenue: 0, margin: 0, cost: 0, roi: 0, recovered: 0, costPerSale: 0, payback: 0 },
        byChannel: [],
        byCampaign: [],
        byProduct: [],
        series: [],
        currency: "ZAR",
      };
    }

    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const { data: settings } = await supabase
      .from("roi_settings")
      .select("currency")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    const currency = (settings?.currency as string) ?? "ZAR";

    const { data: attrs } = await supabase
      .from("roi_attributions")
      .select(
        "id, touchpoint, attributed_revenue_cents, margin_cents, cost_cents, attributed_at, " +
          "campaign:notification_campaigns(id, name, type), product:products(id, name)",
      )
      .eq("retailer_id", retailerId)
      .gte("attributed_at", since)
      .order("attributed_at", { ascending: false })
      .limit(2000);

    const list = (attrs ?? []) as any[];

    let revenue = 0,
      margin = 0,
      cost = 0;
    const byChannel = new Map<string, { channel: string; revenue: number; cost: number; count: number }>();
    const byCampaign = new Map<
      string,
      { id: string; name: string; type: string; revenue: number; cost: number; count: number }
    >();
    const byProduct = new Map<
      string,
      { id: string; name: string; revenue: number; cost: number; count: number }
    >();
    const seriesMap = new Map<string, { date: string; revenue: number; cost: number }>();

    for (const r of list) {
      revenue += r.attributed_revenue_cents ?? 0;
      margin += r.margin_cents ?? 0;
      cost += r.cost_cents ?? 0;

      const ch = (r.touchpoint as string) ?? "manual";
      const chEnt = byChannel.get(ch) ?? { channel: ch, revenue: 0, cost: 0, count: 0 };
      chEnt.revenue += r.attributed_revenue_cents ?? 0;
      chEnt.cost += r.cost_cents ?? 0;
      chEnt.count++;
      byChannel.set(ch, chEnt);

      if (r.campaign?.id) {
        const e =
          byCampaign.get(r.campaign.id) ??
          { id: r.campaign.id, name: r.campaign.name, type: r.campaign.type, revenue: 0, cost: 0, count: 0 };
        e.revenue += r.attributed_revenue_cents ?? 0;
        e.cost += r.cost_cents ?? 0;
        e.count++;
        byCampaign.set(r.campaign.id, e);
      }
      if (r.product?.id) {
        const e = byProduct.get(r.product.id) ?? {
          id: r.product.id,
          name: r.product.name,
          revenue: 0,
          cost: 0,
          count: 0,
        };
        e.revenue += r.attributed_revenue_cents ?? 0;
        e.cost += r.cost_cents ?? 0;
        e.count++;
        byProduct.set(r.product.id, e);
      }

      const d = (r.attributed_at as string).slice(0, 10);
      const se = seriesMap.get(d) ?? { date: d, revenue: 0, cost: 0 };
      se.revenue += r.attributed_revenue_cents ?? 0;
      se.cost += r.cost_cents ?? 0;
      seriesMap.set(d, se);
    }

    const roi = cost > 0 ? revenue / cost : revenue > 0 ? 99 : 0;
    const recovered = list.length;
    const costPerSale = recovered > 0 ? cost / recovered : 0;
    const payback = revenue > 0 ? cost / revenue : 0;

    return {
      kpis: { revenue, margin, cost, roi, recovered, costPerSale, payback },
      byChannel: Array.from(byChannel.values()).sort((a, b) => b.revenue - a.revenue),
      byCampaign: Array.from(byCampaign.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      byProduct: Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      series: Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      currency,
    };
  });

export const getRoiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;
    const { data } = await supabase
      .from("roi_settings")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (data) return data;
    const { data: created } = await supabase
      .from("roi_settings")
      .insert({ retailer_id: retailerId })
      .select()
      .maybeSingle();
    return created;
  });

export const updateRoiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        attribution_window_hours: z.number().int().min(1).max(720),
        cost_per_message_cents: z.number().int().min(0).max(10000),
        default_margin_pct: z.number().min(0).max(1),
        currency: z.string().min(3).max(3),
        model: z.enum(["last_touch", "first_touch", "linear"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { error } = await supabase
      .from("roi_settings")
      .upsert({ retailer_id: retailerId, ...data }, { onConflict: "retailer_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runAttributionSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { data, error } = await supabase.rpc("run_roi_attribution_sweep", { _retailer_id: retailerId });
    if (error) throw new Error(error.message);
    return { inserted: data ?? 0 };
  });

// Purchase-intent signals from a customer tapping "Collection"/"Delivery" on
// a WhatsApp alert — not yet a confirmed sale. A retailer confirms (with the
// real amount) or rejects each one once they know whether it actually sold.
export const listPendingRecoveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customerId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    let q = supabase
      .from("sales_recoveries")
      .select("id, customer_id, product_id, amount_cents, currency, fulfillment, recovered_at, product:products(name, image_url)")
      .eq("retailer_id", retailerId)
      .eq("status", "pending")
      .order("recovered_at", { ascending: false });
    if (data.customerId) q = q.eq("customer_id", data.customerId);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const resolvePendingRecovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["confirm", "reject"]),
        amountCents: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any =
      data.action === "confirm"
        ? { status: "attributed", amount_cents: data.amountCents ?? undefined }
        : { status: "rejected" };
    const { error } = await supabase.from("sales_recoveries").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
