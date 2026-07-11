import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

// Every attribute the browser can group by.
// Extend by adding an entry here + a case in `groupProductsBy`.
export const ATTRIBUTE_CATALOG = [
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Sub-category" },
  { key: "store", label: "Store" },
  { key: "size", label: "Size" },
  { key: "colour", label: "Colour" },
  { key: "variant", label: "Variant" },
  { key: "gender", label: "Gender" },
  { key: "status", label: "Status" },
  { key: "price_band", label: "Price band" },
  { key: "on_promotion", label: "On promotion" },
  { key: "product", label: "Product (leaf)" },
] as const;

export type AttributeKey = typeof ATTRIBUTE_CATALOG[number]["key"];

const levelSchema = z.object({
  id: z.string().optional(),
  position: z.number().int().min(0),
  attribute_key: z.string(),
  label: z.string().min(1).max(80),
});

// ---------------- Profile CRUD ----------------

export const listProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { profiles: [] };
    const { data: profiles } = await supabase
      .from("taxonomy_profiles")
      .select("id, name, is_default, is_published, updated_at")
      .eq("retailer_id", retailerId)
      .order("is_default", { ascending: false })
      .order("name");
    return { profiles: profiles ?? [] };
  });

export const getProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile } = await supabase
      .from("taxonomy_profiles")
      .select("id, name, is_default, is_published, retailer_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const { data: levels } = await supabase
      .from("taxonomy_levels")
      .select("id, position, attribute_key, label")
      .eq("profile_id", profile.id)
      .order("position");
    return { profile, levels: levels ?? [] };
  });

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        levels: z.array(levelSchema),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");

    let profileId = data.id;
    if (profileId) {
      const { error } = await supabase
        .from("taxonomy_profiles")
        .update({ name: data.name })
        .eq("id", profileId);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await supabase
        .from("taxonomy_profiles")
        .insert({ retailer_id: retailerId, name: data.name, created_by: userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      profileId = ins.id;
    }

    // Replace levels wholesale (simple and reliable).
    await supabase.from("taxonomy_levels").delete().eq("profile_id", profileId!);
    if (data.levels.length) {
      const rows = data.levels.map((l, idx) => ({
        profile_id: profileId!,
        position: idx,
        attribute_key: l.attribute_key,
        label: l.label,
      }));
      const { error } = await supabase.from("taxonomy_levels").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, id: profileId };
  });

export const deleteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("taxonomy_profiles")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("taxonomy_profiles")
      .update({ is_default: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), publish: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("taxonomy_profiles")
      .update({ is_published: data.publish })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getActiveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { profile: null, levels: [] as any[] };
    const { data: profiles } = await supabase
      .from("taxonomy_profiles")
      .select("id, name, is_default, is_published")
      .eq("retailer_id", retailerId);
    if (!profiles?.length) return { profile: null, levels: [] };
    const pick =
      profiles.find((p: any) => p.is_published) ??
      profiles.find((p: any) => p.is_default) ??
      profiles[0];
    const { data: levels } = await supabase
      .from("taxonomy_levels")
      .select("id, position, attribute_key, label")
      .eq("profile_id", pick.id)
      .order("position");
    return { profile: pick, levels: levels ?? [] };
  });

// ---------------- Browsing engine ----------------

type BrowseNode = {
  value: string; // filter key (id or literal)
  label: string; // display label
  count: number;
};

function priceBand(cents: number | null): string {
  if (cents == null) return "unknown";
  const r = cents / 100;
  if (r < 50) return "Under R50";
  if (r < 100) return "R50–R100";
  if (r < 250) return "R100–R250";
  if (r < 500) return "R250–R500";
  if (r < 1000) return "R500–R1 000";
  return "Over R1 000";
}

function priceBandOrder(band: string): number {
  const order = ["Under R50", "R50–R100", "R100–R250", "R250–R500", "R500–R1 000", "Over R1 000", "unknown"];
  return order.indexOf(band);
}

/**
 * Browse the retailer's catalogue through an ordered attribute path.
 * `path` maps positions 0..n-1 to the selected filter value at that level.
 * Returns the groups for the next level (position === path.length),
 * or the product leaf list when path already consumed all levels.
 */
export const browseTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        profileId: z.string().uuid().optional(),
        // when set, ignores stored levels and previews with these instead
        dryLevels: z
          .array(z.object({ attribute_key: z.string(), label: z.string() }))
          .optional(),
        path: z.array(z.object({ attribute_key: z.string(), value: z.string() })).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { levels: [], depth: 0, groups: [], products: [] };

    // Resolve levels
    let levels: { attribute_key: string; label: string }[] = [];
    if (data.dryLevels && data.dryLevels.length) {
      levels = data.dryLevels;
    } else if (data.profileId) {
      const { data: rows } = await supabase
        .from("taxonomy_levels")
        .select("attribute_key, label, position")
        .eq("profile_id", data.profileId)
        .order("position");
      levels = (rows ?? []).map((r: any) => ({ attribute_key: r.attribute_key, label: r.label }));
    }
    if (!levels.length) return { levels: [], depth: 0, groups: [], products: [] };

    // Build query with ancestor filters
    let query = supabase
      .from("products")
      .select(
        `id, display_name, name, sku, price_cents, sale_price_cents, stock_qty, low_stock_threshold, currency, status,
         image_url, thumbnail_url, images, size, color, variant, on_promotion,
         brand_id, category_id, store_id,
         brands:brand_id ( id, name, logo_url ),
         product_categories:category_id ( id, name, parent_id ),
         stores:store_id ( id, name )`,
      )
      .eq("retailer_id", retailerId);

    for (const step of data.path) {
      query = applyFilter(query, step.attribute_key, step.value);
    }

    const { data: prods, error } = await query.limit(2000);
    if (error) throw new Error(error.message);

    const depth = data.path.length;

    // Leaf? Return products.
    if (depth >= levels.length || levels[depth]?.attribute_key === "product") {
      return {
        levels,
        depth,
        groups: [],
        products: (prods ?? []).map((p: any) => ({
          id: p.id,
          name: p.display_name || p.name,
          sku: p.sku,
          price_cents: p.price_cents,
          sale_price_cents: p.sale_price_cents,
          currency: p.currency,
          stock_qty: p.stock_qty,
          low_stock_threshold: p.low_stock_threshold,
          image_url: p.thumbnail_url || p.image_url || (Array.isArray(p.images) ? p.images[0]?.url : null),
          brand: p.brands?.name ?? null,
          category: p.product_categories?.name ?? null,
        })),
      };
    }

    const nextAttr = levels[depth].attribute_key;
    const groupMap = new Map<string, { label: string; count: number }>();
    for (const p of prods ?? []) {
      const { value, label } = extractGroup(p, nextAttr);
      if (!value) continue;
      const cur = groupMap.get(value);
      if (cur) cur.count++;
      else groupMap.set(value, { label, count: 1 });
    }
    let groups: BrowseNode[] = Array.from(groupMap.entries()).map(([value, v]) => ({
      value,
      label: v.label,
      count: v.count,
    }));
    if (nextAttr === "price_band") {
      groups.sort((a, b) => priceBandOrder(a.label) - priceBandOrder(b.label));
    } else {
      groups.sort((a, b) => a.label.localeCompare(b.label));
    }
    return { levels, depth, groups, products: [] };
  });

function applyFilter(query: any, attr: string, value: string) {
  switch (attr) {
    case "brand":
      return value === "__none__" ? query.is("brand_id", null) : query.eq("brand_id", value);
    case "category":
      return value === "__none__" ? query.is("category_id", null) : query.eq("category_id", value);
    case "subcategory":
      return query.eq("category_id", value);
    case "store":
      return value === "__none__" ? query.is("store_id", null) : query.eq("store_id", value);
    case "size":
      return value === "__none__" ? query.is("size", null) : query.eq("size", value);
    case "colour":
      return value === "__none__" ? query.is("color", null) : query.eq("color", value);
    case "variant":
      return value === "__none__" ? query.is("variant", null) : query.eq("variant", value);
    case "status":
      return query.eq("status", value);
    case "on_promotion":
      return query.eq("on_promotion", value === "yes");
    case "gender":
      // Stored inside variant/normalisation_payload; fall back to variant text.
      return query.ilike("variant", `%${value}%`);
    case "price_band":
      return query; // filtered client-side after fetch
    default:
      return query;
  }
}

function extractGroup(p: any, attr: string): { value: string; label: string } {
  switch (attr) {
    case "brand":
      return p.brand_id
        ? { value: p.brand_id, label: p.brands?.name ?? "Unknown brand" }
        : { value: "__none__", label: "Unbranded" };
    case "category":
      return p.category_id
        ? { value: p.category_id, label: p.product_categories?.name ?? "Uncategorised" }
        : { value: "__none__", label: "Uncategorised" };
    case "subcategory":
      return p.category_id
        ? { value: p.category_id, label: p.product_categories?.name ?? "—" }
        : { value: "__none__", label: "Uncategorised" };
    case "store":
      return p.store_id
        ? { value: p.store_id, label: p.stores?.name ?? "Store" }
        : { value: "__none__", label: "No store" };
    case "size":
      return p.size
        ? { value: String(p.size), label: String(p.size) }
        : { value: "__none__", label: "No size" };
    case "colour":
      return p.color
        ? { value: String(p.color), label: String(p.color) }
        : { value: "__none__", label: "No colour" };
    case "variant":
      return p.variant
        ? { value: String(p.variant), label: String(p.variant) }
        : { value: "__none__", label: "No variant" };
    case "status":
      return { value: String(p.status ?? "active"), label: String(p.status ?? "active") };
    case "on_promotion":
      return p.on_promotion
        ? { value: "yes", label: "On promotion" }
        : { value: "no", label: "Regular price" };
    case "gender": {
      const v = String(p.variant ?? "").toLowerCase();
      if (v.includes("women")) return { value: "women", label: "Women" };
      if (v.includes("men")) return { value: "men", label: "Men" };
      if (v.includes("kids") || v.includes("child")) return { value: "kids", label: "Kids" };
      return { value: "unisex", label: "Unisex / unspecified" };
    }
    case "price_band": {
      const band = priceBand(p.sale_price_cents ?? p.price_cents);
      return { value: band, label: band };
    }
    default:
      return { value: "__none__", label: "—" };
  }
}
