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

export const listQrTagsRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().optional(),
        storeId: z.string().uuid().optional(),
        status: z.enum(["all", "active", "inactive"]).default("all"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { rows: [], totals: { active: 0, inactive: 0, scans: 0 } };

    let q = supabase
      .from("qr_tags")
      .select(
        "id, short_code, label, is_active, created_at, product:products(id, name, image_url), store:stores(id, name)",
      )
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status === "active") q = q.eq("is_active", true);
    if (data.status === "inactive") q = q.eq("is_active", false);
    if (data.storeId) q = q.eq("store_id", data.storeId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    let scansByTag = new Map<string, { total: number; unique: Set<string>; last: string | null }>();
    if (ids.length) {
      const { data: scans } = await supabase
        .from("qr_scans")
        .select("qr_tag_id, customer_id, scanned_at")
        .in("qr_tag_id", ids);
      for (const s of (scans ?? []) as any[]) {
        const e = scansByTag.get(s.qr_tag_id) ?? { total: 0, unique: new Set<string>(), last: null };
        e.total++;
        if (s.customer_id) e.unique.add(s.customer_id);
        if (!e.last || s.scanned_at > e.last) e.last = s.scanned_at;
        scansByTag.set(s.qr_tag_id, e);
      }
    }

    let result = (rows ?? []).map((r: any) => {
      const s = scansByTag.get(r.id);
      return {
        ...r,
        scans_total: s?.total ?? 0,
        unique_scanners: s?.unique.size ?? 0,
        last_scan_at: s?.last ?? null,
      };
    });

    if (data.search) {
      const s = data.search.toLowerCase();
      result = result.filter(
        (r: any) =>
          r.short_code?.toLowerCase().includes(s) ||
          r.label?.toLowerCase().includes(s) ||
          r.product?.name?.toLowerCase().includes(s),
      );
    }

    const totals = {
      active: result.filter((r: any) => r.is_active).length,
      inactive: result.filter((r: any) => !r.is_active).length,
      scans: result.reduce((a: number, r: any) => a + r.scans_total, 0),
    };

    return { rows: result, totals };
  });

export const toggleTagStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("qr_tags")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
