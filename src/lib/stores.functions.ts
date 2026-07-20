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

export const listStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];

    const { data: stores } = await supabase
      .from("stores")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("name");

    const ids = (stores ?? []).map((s: any) => s.id);
    const stats = new Map<string, { scans: number; recovered: number; staff: number }>();
    if (ids.length) {
      const [scans, recoveries, staff] = await Promise.all([
        supabase.from("qr_scans").select("store_id").in("store_id", ids),
        supabase.from("sales_recoveries").select("amount_cents, product:products(store_id)").eq("retailer_id", retailerId),
        supabase.from("staff").select("store_id").in("store_id", ids),
      ]);
      for (const s of (scans.data ?? []) as any[]) {
        if (!s.store_id) continue;
        const e = stats.get(s.store_id) ?? { scans: 0, recovered: 0, staff: 0 };
        e.scans++;
        stats.set(s.store_id, e);
      }
      for (const s of (staff.data ?? []) as any[]) {
        if (!s.store_id) continue;
        const e = stats.get(s.store_id) ?? { scans: 0, recovered: 0, staff: 0 };
        e.staff++;
        stats.set(s.store_id, e);
      }
      for (const r of (recoveries.data ?? []) as any[]) {
        const sid = r.product?.store_id;
        if (!sid) continue;
        const e = stats.get(sid) ?? { scans: 0, recovered: 0, staff: 0 };
        e.recovered += r.amount_cents ?? 0;
        stats.set(sid, e);
      }
    }

    return (stores ?? []).map((s: any) => ({
      ...s,
      scans: stats.get(s.id)?.scans ?? 0,
      recovered_cents: stats.get(s.id)?.recovered ?? 0,
      staff_count: stats.get(s.id)?.staff ?? 0,
    }));
  });

export const upsertStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        address: z.string().trim().max(240).optional().nullable(),
        city: z.string().trim().max(80).optional().nullable(),
        province: z.string().trim().max(80).optional().nullable(),
        country: z.string().trim().max(80).optional().nullable(),
        timezone: z.string().trim().max(80).optional().nullable(),
        manager_name: z.string().trim().max(120).optional().nullable(),
        contact_phone: z.string().trim().max(40).optional().nullable(),
        status: z.enum(["active", "closed", "pending"]).default("active"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { id, ...payload } = data;
    if (id) {
      const { error } = await supabase.from("stores").update(payload as any).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("stores")
        .insert({ ...payload, retailer_id: retailerId, created_by: userId } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Called at the end of product import. Products already carry a
// `store_id` when the source file had a branch/site/plant column, and
// the importer auto-creates the store row for each distinct branch it
// sees — so most retailers will already have their real stores. This
// helper handles the leftover case: a retailer whose file had no
// branch column at all (single-shop merchants) ends up with zero
// stores, which then breaks store-scoped screens. If that's the case
// we create one "Sole proprietor" placeholder so the rest of the app
// has a store to hang scans, staff and recoveries off.
export const ensureRetailerHasStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { created: false, storeCount: 0 };

    const { count } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailerId);

    if ((count ?? 0) > 0) return { created: false, storeCount: count ?? 0 };

    const { error } = await supabase.from("stores").insert({
      retailer_id: retailerId,
      name: "Sole proprietor",
      status: "active",
      created_by: userId,
    } as any);
    if (error) throw new Error(error.message);
    return { created: true, storeCount: 1 };
  });
