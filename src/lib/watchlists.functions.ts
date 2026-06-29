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

export const listWatchlists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["all", "active", "paused", "fired", "expired", "cancelled"]).default("all"),
        trigger: z.string().optional(),
        search: z.string().trim().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { rows: [], totals: { active: 0, fired: 0, paused: 0 } };

    let q = supabase
      .from("watchlists")
      .select(
        "id, status, trigger, target_price_cents, fired_count, last_fired_at, created_at, expires_at, " +
          "customer:customers(id, full_name, whatsapp_e164), " +
          "product:products(id, name, image_url, price_cents, sale_price_cents, stock_qty)",
      )
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.trigger) q = q.eq("trigger", data.trigger);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let result = rows ?? [];
    if (data.search) {
      const s = data.search.toLowerCase();
      result = result.filter(
        (r: any) =>
          r.product?.name?.toLowerCase().includes(s) ||
          r.customer?.full_name?.toLowerCase().includes(s) ||
          r.customer?.whatsapp_e164?.includes(s),
      );
    }

    const { data: totalsRows } = await supabase
      .from("watchlists")
      .select("status")
      .eq("retailer_id", retailerId);
    const totals = { active: 0, fired: 0, paused: 0 };
    for (const t of totalsRows ?? []) {
      if ((t as any).status === "active") totals.active++;
      else if ((t as any).status === "fired") totals.fired++;
      else if ((t as any).status === "paused") totals.paused++;
    }

    return { rows: result, totals };
  });

export const getWatchlistOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { topProducts: [], recentEvents: [], conversion: { active: 0, fired: 0, recovered: 0 } };

    const { data: events } = await supabase
      .from("watchlist_events")
      .select(
        "id, created_at, trigger, payload, watchlist:watchlists(id, customer:customers(full_name), product:products(name))",
      )
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: all } = await supabase
      .from("watchlists")
      .select("product_id, product:products(id, name, image_url), status")
      .eq("retailer_id", retailerId);
    const map = new Map<string, { id: string; name: string; image_url: string | null; count: number }>();
    for (const r of (all ?? []) as any[]) {
      if (!r.product) continue;
      const key = r.product.id;
      const ent = map.get(key) ?? { id: key, name: r.product.name, image_url: r.product.image_url, count: 0 };
      ent.count++;
      map.set(key, ent);
    }
    const topProducts = Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6);

    const active = (all ?? []).filter((r: any) => r.status === "active").length;
    const fired = (all ?? []).filter((r: any) => r.status === "fired").length;

    const { count: recovered } = await supabase
      .from("roi_attributions")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailerId)
      .eq("touchpoint", "watchlist");

    return {
      topProducts,
      recentEvents: events ?? [],
      conversion: { active, fired, recovered: recovered ?? 0 },
    };
  });

export const triggerWatchlistNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: w, error } = await supabase
      .from("watchlists")
      .select("id, retailer_id, trigger")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !w) throw new Error("Watchlist not found");

    const { error: insErr } = await supabase.from("watchlist_events").insert({
      watchlist_id: w.id,
      retailer_id: w.retailer_id,
      trigger: w.trigger,
      payload: { manual: true },
    });
    if (insErr) throw new Error(insErr.message);

    await supabase
      .from("watchlists")
      .update({ last_fired_at: new Date().toISOString(), fired_count: 1, status: "fired" })
      .eq("id", w.id);

    return { ok: true };
  });

export const updateWatchlistStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "paused", "cancelled"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlists")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
