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

type LevelRow = {
  id?: string;
  position: number;
  attribute_key: string;
  label: string;
  hidden: boolean;
};

// `hidden` is a newer column that may not exist yet on a database that
// hasn't had this migration deployed. Try selecting it; if that 400s
// (column doesn't exist), fall back to the columns that are always there
// so profile loading never breaks while a deploy is pending.
async function fetchLevels(
  supabase: any,
  profileId: string,
  opts: { onlyVisible?: boolean } = {},
): Promise<LevelRow[]> {
  let q = supabase
    .from("taxonomy_levels")
    .select("id, position, attribute_key, label, hidden")
    .eq("profile_id", profileId);
  if (opts.onlyVisible) q = q.eq("hidden", false);
  const { data, error } = await q.order("position");
  if (!error) return (data ?? []) as LevelRow[];

  const { data: fallback } = await supabase
    .from("taxonomy_levels")
    .select("id, position, attribute_key, label")
    .eq("profile_id", profileId)
    .order("position");
  return (fallback ?? []).map((r: any) => ({ ...r, hidden: false }));
}

// Every attribute the browser can group by.
// Extend by adding an entry here + a case in `groupProductsBy`.
export const ATTRIBUTE_CATALOG = [
  { key: "department", label: "Department" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Sub-category" },
  { key: "product_family", label: "Product Family" },
  { key: "supplier", label: "Supplier" },
  { key: "range", label: "Range" },
  { key: "collection", label: "Collection" },
  { key: "style", label: "Style / Model" },
  { key: "season", label: "Season" },
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

// Department/Category/Sub-category are resolved by walking the (arbitrarily
// deep, self-referencing) product_categories tree: depth 0 = root ancestor
// ("Department"), depth 1 = its child ("Category"), depth 2 = grandchild
// ("Sub-category"). A product whose own category sits shallower than the
// requested depth has no value at that level ("__none__").
const CATEGORY_DEPTH: Record<string, number> = { department: 0, category: 1, subcategory: 2 };

type CatRow = { id: string; name: string; parent_id: string | null };

function ancestorChain(catId: string | null | undefined, byId: Map<string, CatRow>): CatRow[] {
  const chain: CatRow[] = [];
  let cur = catId ? byId.get(catId) : undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    chain.unshift(cur);
    seen.add(cur.id);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return chain;
}

function ancestorAtDepth(
  catId: string | null | undefined,
  depth: number,
  byId: Map<string, CatRow>,
): CatRow | null {
  return ancestorChain(catId, byId)[depth] ?? null;
}

function categoryIdsAtDepth(byId: Map<string, CatRow>, depth: number, value: string): string[] {
  const ids: string[] = [];
  for (const cat of byId.values()) {
    const anc = ancestorAtDepth(cat.id, depth, byId);
    if (value === "__none__" ? !anc : anc?.id === value) ids.push(cat.id);
  }
  return ids;
}

export type AttributeKey = (typeof ATTRIBUTE_CATALOG)[number]["key"];

const levelSchema = z.object({
  id: z.string().optional(),
  position: z.number().int().min(0),
  attribute_key: z.string(),
  label: z.string().min(1).max(80),
  hidden: z.boolean().optional().default(false),
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
    const levels = await fetchLevels(supabase, profile.id);
    return { profile, levels };
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
        hidden: l.hidden ?? false,
      }));
      // `hidden` may not exist yet on a database that hasn't had this
      // migration deployed — fall back to inserting without it so saving a
      // profile never breaks while a deploy is pending.
      const { error } = await supabase.from("taxonomy_levels").insert(rows as any);
      if (error) {
        const rowsWithoutHidden = rows.map(({ hidden, ...rest }) => rest);
        const { error: fallbackError } = await supabase
          .from("taxonomy_levels")
          .insert(rowsWithoutHidden);
        if (fallbackError) throw new Error(fallbackError.message);
      }
    }
    return { ok: true, id: profileId };
  });

export const deleteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("taxonomy_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    // Belt-and-braces: clear siblings first (a trigger also enforces this).
    await supabase
      .from("taxonomy_profiles")
      .update({ is_default: false })
      .eq("retailer_id", retailerId)
      .neq("id", data.id);
    const { error } = await supabase
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
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    if (data.publish) {
      // Only one profile is published at a time — matches how the browser picks the active layout.
      await supabase
        .from("taxonomy_profiles")
        .update({ is_published: false })
        .eq("retailer_id", retailerId)
        .neq("id", data.id);
    }
    const { error } = await supabase
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
    // Published beats default beats first — publishing is the explicit "make this live" action.
    const pick =
      profiles.find((p: any) => p.is_published) ??
      profiles.find((p: any) => p.is_default) ??
      profiles[0];
    const levels = await fetchLevels(supabase, pick.id, { onlyVisible: true });
    return { profile: pick, levels };
  });

// ---------------- Auto-detect profile from imported products ----------------
// Keyword signals used to guess which sector template best matches a batch
// of freshly-imported products, keyed by TAXONOMY_TEMPLATES id.
const TEMPLATE_SIGNALS: Record<string, RegExp[]> = {
  "fashion-apparel": [
    /\b(shirt|t-?shirt|blouse|jumper|hoodie|jacket|coat|jean|pants?|trouser|shorts|skirt|dress|shoe|sneaker|boot|sandal|heel|apparel|clothing|footwear)\b/i,
  ],
  "grocery-supermarket": [
    /\b(biscuit|cookie|chocolate|coffee|tea|milk|yoghurt|cheese|bread|snack|cereal|pasta|rice|sauce|juice|soda|beverage|grocery|fmcg)\b/i,
  ],
  "pharmacy-health": [
    /\b(tablet|capsule|vitamin|paracetamol|ibuprofen|syrup|ointment|dosage|pharmacy|medicine|analgesic)\b/i,
  ],
  "electronics-appliances": [
    /\b(phone|laptop|charger|cable|headphone|earbud|speaker|television|\btv\b|fridge|microwave|blender|appliance|electronics)\b/i,
  ],
  "home-diy-hardware": [
    /\b(drill|screwdriver|hammer|nail|screw|paint|hardware|power tool|cement|timber|plumbing)\b/i,
  ],
  "sporting-outdoor": [
    /\b(tent|backpack|hiking|camping|bicycle|gym|fitness|football|rugby|cricket|golf|outdoor)\b/i,
  ],
  "beauty-cosmetics": [
    /\b(lipstick|mascara|foundation|skincare|shampoo|conditioner|moistur|serum|cosmetic|makeup)\b/i,
  ],
  "liquor-bottle-store": [/\b(beer|wine|whisky|vodka|gin|rum|cider|liquor|spirits)\b/i],
  "automotive-parts": [
    /\b(tyre|tire|brake pad|exhaust|spark plug|oil filter|automotive|car part)\b/i,
  ],
  "toys-games": [/\b(toy|doll|lego|puzzle|board game|action figure)\b/i],
  "furniture-homeware": [
    /\b(sofa|couch|coffee table|armchair|furniture|decor|homeware|cushion|curtain)\b/i,
  ],
  "pet-supplies": [/\b(dog food|cat food|pet food|leash|collar|aquarium|\bpet\b)\b/i],
  "baby-kids": [/\b(nappy|diaper|baby|infant|toddler|stroller|pram)\b/i],
  "books-stationery-office": [
    /\b(novel|paperback|hardcover|pen|pencil|notebook|stationery|office supply)\b/i,
  ],
  "wholesale-cash-carry": [/\b(bulk|wholesale|cash and carry|pack of \d+|case of \d+)\b/i],
};

// Categories that lean on size/colour as a defining attribute (apparel-like
// sectors) get a small bonus when most imported rows carry those fields —
// keyword hits alone under-detect plain SKU names like "Men's Crew Tee M".
const SIZE_COLOUR_BONUS_TEMPLATES = ["fashion-apparel", "sporting-outdoor", "baby-kids"];

type DetectableRow = {
  name: string;
  category_name?: string | null;
  brand?: string | null;
  description?: string | null;
  size?: string | null;
  color?: string | null;
};

// Minimum keyword score required before we act — avoids mis-tagging an
// ambiguous/mixed import with a confident-looking wrong sector.
const DETECTION_THRESHOLD = 3;

export function detectTaxonomyTemplateId(rows: DetectableRow[]): string | null {
  if (!rows.length) return null;
  const scores = new Map<string, number>();
  for (const row of rows) {
    const hay = `${row.name} ${row.category_name ?? ""} ${row.brand ?? ""} ${row.description ?? ""}`;
    for (const [id, patterns] of Object.entries(TEMPLATE_SIGNALS)) {
      if (patterns.some((p) => p.test(hay))) {
        scores.set(id, (scores.get(id) ?? 0) + 1);
      }
    }
  }
  const sizeColourShare = rows.filter((r) => r.size || r.color).length / rows.length;
  if (sizeColourShare > 0.4) {
    for (const id of SIZE_COLOUR_BONUS_TEMPLATES) {
      scores.set(id, (scores.get(id) ?? 0) + 2);
    }
  }
  let bestId: string | null = null;
  let bestScore = 0;
  for (const [id, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestScore >= DETECTION_THRESHOLD ? bestId : null;
}

/**
 * Auto-detect and apply the taxonomy profile that best matches a batch of
 * imported products. Only acts the first time a retailer imports products —
 * once they have any taxonomy profile (auto-created or hand-built), this is
 * a no-op so it never overrides deliberate configuration.
 */
export async function autoDetectTaxonomyProfile(opts: {
  supabase: any;
  retailerId: string;
  userId?: string;
  rows: DetectableRow[];
}): Promise<{ applied: boolean; templateName?: string }> {
  const { supabase, retailerId, userId, rows } = opts;

  const { count } = await supabase
    .from("taxonomy_profiles")
    .select("id", { count: "exact", head: true })
    .eq("retailer_id", retailerId);
  if ((count ?? 0) > 0) return { applied: false };

  const templateId = detectTaxonomyTemplateId(rows);
  if (!templateId) return { applied: false };

  const { TAXONOMY_TEMPLATES } = await import("./taxonomy-templates");
  const template = TAXONOMY_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return { applied: false };

  const { data: profile, error } = await supabase
    .from("taxonomy_profiles")
    .insert({
      retailer_id: retailerId,
      name: template.name,
      created_by: userId ?? null,
      is_default: true,
      is_published: true,
    })
    .select("id")
    .single();
  if (error || !profile) return { applied: false };

  const levelRows = template.levels.map((l, idx) => ({
    profile_id: profile.id,
    position: idx,
    attribute_key: l.attribute_key,
    label: l.label,
    hidden: false,
  }));
  const { error: lvlErr } = await supabase.from("taxonomy_levels").insert(levelRows as any);
  if (lvlErr) {
    const rowsNoHidden = levelRows.map(({ hidden, ...rest }) => rest);
    await supabase.from("taxonomy_levels").insert(rowsNoHidden);
  }
  return { applied: true, templateName: template.name };
}

// Seed all built-in sector templates (Fashion & Apparel, Grocery, Pharmacy, …)
// as ready-to-pick profiles for the current retailer. Idempotent — skips any
// template whose name is already present.
export const seedSectorTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");

    const { TAXONOMY_TEMPLATES } = await import("./taxonomy-templates");

    const { data: existing } = await supabase
      .from("taxonomy_profiles")
      .select("name")
      .eq("retailer_id", retailerId);
    const existingNames = new Set((existing ?? []).map((r: any) => r.name));

    let created = 0;
    for (const t of TAXONOMY_TEMPLATES) {
      if (existingNames.has(t.name)) continue;
      const { data: ins, error } = await supabase
        .from("taxonomy_profiles")
        .insert({ retailer_id: retailerId, name: t.name, created_by: userId })
        .select("id")
        .single();
      if (error || !ins) continue;
      const rows = t.levels.map((l, idx) => ({
        profile_id: ins.id,
        position: idx,
        attribute_key: l.attribute_key,
        label: l.label,
        hidden: false,
      }));
      const { error: lvlErr } = await supabase.from("taxonomy_levels").insert(rows as any);
      if (lvlErr) {
        const rowsNoHidden = rows.map(({ hidden, ...rest }) => rest);
        await supabase.from("taxonomy_levels").insert(rowsNoHidden);
      }
      created++;
    }
    return { created, total: TAXONOMY_TEMPLATES.length };
  });

// ---------------- Custom attribute values ----------------
// Lets a retailer pre-declare the known values of a custom (JSONB-backed)
// level before any product carries one, the same way categories/brands can
// be created ahead of tagging products into them.

export const listAttributeValues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attribute_key: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { values: [] as { id: string; value: string; label: string }[] };
    const { data: rows, error } = await (supabase as any)
      .from("taxonomy_attribute_values")
      .select("id, value, label")
      .eq("retailer_id", retailerId)
      .eq("attribute_key", data.attribute_key)
      .order("label");
    if (error) return { values: [] };
    return { values: rows ?? [] };
  });

export const createAttributeValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        attribute_key: z.string(),
        label: z.string().trim().min(1).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { error } = await (supabase as any).from("taxonomy_attribute_values").insert({
      retailer_id: retailerId,
      attribute_key: data.attribute_key,
      value: data.label.trim(),
      label: data.label.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAttributeValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("taxonomy_attribute_values")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
  const order = [
    "Under R50",
    "R50–R100",
    "R100–R250",
    "R250–R500",
    "R500–R1 000",
    "Over R1 000",
    "unknown",
  ];
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
          .array(
            z.object({
              attribute_key: z.string(),
              label: z.string(),
              hidden: z.boolean().optional(),
            }),
          )
          .optional(),
        path: z.array(z.object({ attribute_key: z.string(), value: z.string() })).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { levels: [], depth: 0, groups: [], products: [] };

    // Resolve levels — hidden levels stay configured but never appear in the
    // actual browse hierarchy.
    let levels: { attribute_key: string; label: string }[] = [];
    if (data.dryLevels && data.dryLevels.length) {
      levels = data.dryLevels.filter((l) => !l.hidden);
    } else if (data.profileId) {
      const rows = await fetchLevels(supabase, data.profileId, { onlyVisible: true });
      levels = rows.map((r) => ({ attribute_key: r.attribute_key, label: r.label }));
    }
    if (!levels.length) return { levels: [], depth: 0, groups: [], products: [] };

    // Full category tree (small, bounded set) so department/category/
    // sub-category can be resolved by actual depth rather than a single
    // fixed column.
    const { data: catRows } = await supabase
      .from("product_categories")
      .select("id, name, parent_id")
      .eq("retailer_id", retailerId);
    const catById = new Map<string, CatRow>((catRows ?? []).map((c: CatRow) => [c.id, c]));

    // Only request the newer attribute columns when a level actually uses
    // them, so profiles that don't touch Supplier/Range/Collection/Season
    // keep working even before that migration has been deployed.
    const usedKeys = new Set(levels.map((l) => l.attribute_key));
    const hasCustom = [...usedKeys].some((k) => k.startsWith("custom:"));
    const extraCols = [
      usedKeys.has("product_family") && "product_family",
      usedKeys.has("supplier") && "supplier",
      usedKeys.has("range") && "range_name",
      usedKeys.has("collection") && "collection",
      usedKeys.has("style") && "style",
      usedKeys.has("season") && "season",
      hasCustom && "custom_attributes",
    ].filter(Boolean) as string[];

    // Build query with ancestor filters
    let query = supabase
      .from("products")
      .select(
        `id, display_name, name, sku, price_cents, sale_price_cents, stock_qty, low_stock_threshold, currency, status,
         image_url, thumbnail_url, images, size, color, variant, on_promotion,
         ${extraCols.length ? extraCols.join(", ") + "," : ""}
         brand_id, category_id, store_id,
         brands:brand_id ( id, name, logo_url ),
         product_categories:category_id ( id, name, parent_id ),
         stores:store_id ( id, name )`,
      )
      .eq("retailer_id", retailerId);

    for (const step of data.path) {
      query = applyFilter(query, step.attribute_key, step.value, catById);
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
          image_url:
            p.thumbnail_url || p.image_url || (Array.isArray(p.images) ? p.images[0]?.url : null),
          brand: p.brands?.name ?? null,
          category: p.product_categories?.name ?? null,
        })),
      };
    }

    const nextAttr = levels[depth].attribute_key;
    const groupMap = new Map<string, { label: string; count: number }>();
    for (const p of prods ?? []) {
      const { value, label } = extractGroup(p, nextAttr, catById);
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

// Attributes that map to a single literal (non-hierarchical) product column
// and are therefore safe to reassign directly via drag-and-drop in the
// generic attribute admin tab / preview. Category/department/subcategory are
// deliberately excluded — they're reassigned via `moveProductCategory`
// against the category tree instead. Derived/computed attributes (gender,
// status, price_band, on_promotion) aren't reassignable this way either.
const REASSIGNABLE_COLUMNS: Record<string, string> = {
  brand: "brand_id",
  store: "store_id",
  size: "size",
  colour: "color",
  variant: "variant",
  product_family: "product_family",
  supplier: "supplier",
  range: "range_name",
  collection: "collection",
  style: "style",
  season: "season",
};

export const moveProductAttribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        attribute_key: z.string(),
        value: z.string(), // "__none__" clears the attribute
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { productId, attribute_key, value } = data;
    const newValue = value === "__none__" ? null : value;

    if (attribute_key.startsWith("custom:")) {
      const slug = attribute_key.slice("custom:".length);
      const { data: current } = await (supabase as any)
        .from("products")
        .select("custom_attributes")
        .eq("id", productId)
        .maybeSingle();
      const attrs = { ...(current?.custom_attributes ?? {}) };
      if (newValue == null) delete attrs[slug];
      else attrs[slug] = newValue;
      const { error } = await (supabase as any)
        .from("products")
        .update({ custom_attributes: attrs })
        .eq("id", productId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const col = REASSIGNABLE_COLUMNS[attribute_key];
    if (!col) throw new Error(`"${attribute_key}" cannot be reassigned this way`);
    const { error } = await supabase
      .from("products")
      .update({ [col]: newValue } as any)
      .eq("id", productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function applyFilter(query: any, attr: string, value: string, catById: Map<string, CatRow>) {
  if (attr in CATEGORY_DEPTH) {
    const depth = CATEGORY_DEPTH[attr];
    const ids = categoryIdsAtDepth(catById, depth, value);
    if (value === "__none__") {
      return ids.length
        ? query.or(`category_id.is.null,category_id.in.(${ids.join(",")})`)
        : query.is("category_id", null);
    }
    return ids.length
      ? query.in("category_id", ids)
      : query.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  if (attr.startsWith("custom:")) {
    const slug = attr.slice("custom:".length);
    const col = `custom_attributes->>${slug}`;
    return value === "__none__" ? query.is(col, null) : query.eq(col, value);
  }
  switch (attr) {
    case "brand":
      return value === "__none__" ? query.is("brand_id", null) : query.eq("brand_id", value);
    case "product_family":
      return value === "__none__"
        ? query.is("product_family", null)
        : query.eq("product_family", value);
    case "supplier":
      return value === "__none__" ? query.is("supplier", null) : query.eq("supplier", value);
    case "range":
      return value === "__none__" ? query.is("range_name", null) : query.eq("range_name", value);
    case "collection":
      return value === "__none__" ? query.is("collection", null) : query.eq("collection", value);
    case "style":
      return value === "__none__" ? query.is("style", null) : query.eq("style", value);
    case "season":
      return value === "__none__" ? query.is("season", null) : query.eq("season", value);
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

function extractGroup(
  p: any,
  attr: string,
  catById: Map<string, CatRow>,
): { value: string; label: string } {
  if (attr in CATEGORY_DEPTH) {
    const depth = CATEGORY_DEPTH[attr];
    const anc = ancestorAtDepth(p.category_id, depth, catById);
    if (anc) return { value: anc.id, label: anc.name };
    const noneLabel =
      attr === "department"
        ? "No department"
        : attr === "category"
          ? "Uncategorised"
          : "No sub-category";
    return { value: "__none__", label: noneLabel };
  }
  if (attr.startsWith("custom:")) {
    const slug = attr.slice("custom:".length);
    const v = p.custom_attributes?.[slug];
    return v ? { value: String(v), label: String(v) } : { value: "__none__", label: "No value" };
  }
  switch (attr) {
    case "brand":
      return p.brand_id
        ? { value: p.brand_id, label: p.brands?.name ?? "Unknown brand" }
        : { value: "__none__", label: "Unbranded" };
    case "product_family":
      return p.product_family
        ? { value: String(p.product_family), label: String(p.product_family) }
        : { value: "__none__", label: "No product family" };
    case "supplier":
      return p.supplier
        ? { value: String(p.supplier), label: String(p.supplier) }
        : { value: "__none__", label: "No supplier" };
    case "range":
      return p.range_name
        ? { value: String(p.range_name), label: String(p.range_name) }
        : { value: "__none__", label: "No range" };
    case "collection":
      return p.collection
        ? { value: String(p.collection), label: String(p.collection) }
        : { value: "__none__", label: "No collection" };
    case "style":
      return p.style
        ? { value: String(p.style), label: String(p.style) }
        : { value: "__none__", label: "No style" };
    case "season":
      return p.season
        ? { value: String(p.season), label: String(p.season) }
        : { value: "__none__", label: "No season" };
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
