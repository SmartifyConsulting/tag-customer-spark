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

export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { rows: [] };
    const { data, error } = await supabase
      .from("product_categories")
      .select("id, name, parent_id, status, created_at")
      .eq("retailer_id", retailerId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const listCategoriesWithCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId)
      return { rows: [], counts: {}, uncategorisedCount: 0, suggestedCount: 0 };
    const [{ data: cats, error: cErr }, { data: prods, error: pErr }] =
      await Promise.all([
        supabase
          .from("product_categories")
          .select("id, name, parent_id, status, created_at")
          .eq("retailer_id", retailerId)
          .order("name", { ascending: true }),
        supabase
          .from("products")
          .select("id, category_id, suggested_category_id, status")
          .eq("retailer_id", retailerId)
          .neq("status", "archived"),
      ]);
    if (cErr) throw new Error(cErr.message);
    if (pErr) throw new Error(pErr.message);
    const counts: Record<string, number> = {};
    let uncategorisedCount = 0;
    let suggestedCount = 0;
    for (const p of prods ?? []) {
      if (!p.category_id) uncategorisedCount++;
      else counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
      if (p.suggested_category_id && p.suggested_category_id !== p.category_id)
        suggestedCount++;
    }
    return { rows: cats ?? [], counts, uncategorisedCount, suggestedCount };
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        parent_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { error } = await supabase.from("product_categories").insert({
      retailer_id: retailerId,
      name: data.name,
      parent_id: data.parent_id ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_categories")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Auto-categorisation ----------

const KEYWORD_MAP: Array<{ match: RegExp; category: string }> = [
  { match: /\b(biscuit|cookie|rusk|wafer)\b/i, category: "Biscuits" },
  { match: /\b(chocolate|cocoa|candy|sweet|gum|lolly)\b/i, category: "Confectionery" },
  { match: /\b(coffee|espresso|nespresso|cappuccino)\b/i, category: "Coffee" },
  { match: /\b(tea|rooibos|chai)\b/i, category: "Tea" },
  { match: /\b(milk|yoghur|cheese|butter|cream|dairy)\b/i, category: "Dairy" },
  { match: /\b(bread|loaf|roll|bakery|croissant|bun)\b/i, category: "Bakery" },
  { match: /\b(chip|crisp|snack|popcorn|pretzel|nuts?)\b/i, category: "Snacks" },
  { match: /\b(cereal|muesli|granola|oat|porridge)\b/i, category: "Cereals" },
  { match: /\b(pasta|noodle|rice|couscous|quinoa)\b/i, category: "Pantry" },
  { match: /\b(sauce|ketchup|mayo|mustard|dressing|vinegar|oil)\b/i, category: "Condiments" },
  { match: /\b(juice|soda|cola|water|drink|beverage|energy)\b/i, category: "Beverages" },
  { match: /\b(beer|wine|whisky|vodka|gin|rum|cider)\b/i, category: "Alcohol" },
  { match: /\b(shampoo|conditioner|soap|toothpaste|deodorant|razor|lotion)\b/i, category: "Personal Care" },
  { match: /\b(detergent|bleach|cleaner|dishwash|laundry)\b/i, category: "Household" },
  { match: /\b(shirt|tshirt|t-shirt|top|blouse|jumper|hoodie|jacket|coat)\b/i, category: "Apparel" },
  { match: /\b(jean|pants?|trouser|shorts|skirt|dress)\b/i, category: "Apparel" },
  { match: /\b(shoe|sneaker|boot|sandal|heel)\b/i, category: "Footwear" },
  { match: /\b(bag|wallet|purse|belt|hat|scarf|glove)\b/i, category: "Accessories" },
  { match: /\b(phone|laptop|charger|cable|headphone|earbud|speaker)\b/i, category: "Electronics" },
  { match: /\b(toy|doll|lego|puzzle|game)\b/i, category: "Toys" },
];

function keywordCategory(name: string, brand?: string | null, description?: string | null) {
  const hay = `${name} ${brand ?? ""} ${description ?? ""}`;
  for (const { match, category } of KEYWORD_MAP) {
    if (match.test(hay)) return category;
  }
  return null;
}

type CatRow = { id: string; name: string; parent_id: string | null };

async function callAiCategoryPick(args: {
  name: string;
  brand?: string | null;
  description?: string | null;
  gtin?: string | null;
  categories: CatRow[];
}): Promise<{ existing_category_id?: string; new_category?: string; confidence: number } | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const tree = args.categories.map((c) => ({
    id: c.id,
    name: c.name,
    parent: args.categories.find((p) => p.id === c.parent_id)?.name ?? null,
  }));
  const prompt = `Product:
name: ${args.name}
brand: ${args.brand ?? ""}
description: ${args.description ?? ""}
gtin: ${args.gtin ?? ""}

Existing categories (JSON):
${JSON.stringify(tree)}

Pick the single best existing_category_id from the list. If NONE reasonably fit, propose a short new_category name (2-3 words, Title Case). Return JSON only.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You classify retail products into a category tree. Reply with JSON: {\"existing_category_id\":string|null,\"new_category\":string|null,\"confidence\":number 0-1}.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const raw = j.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      existing_category_id: parsed.existing_category_id || undefined,
      new_category: parsed.new_category || undefined,
      confidence: Number(parsed.confidence ?? 0.5),
    };
  } catch {
    return null;
  }
}

/**
 * Suggest (and if apply=true, assign) a category for a product.
 * Uses existing categories via AI; falls back to keyword heuristics;
 * creates a new category when needed. Never overwrites a manual category
 * unless `apply` is true AND product has no category yet.
 */
export async function suggestCategoryForProduct(opts: {
  supabase: any;
  retailerId: string;
  userId?: string;
  product: {
    id?: string;
    name: string;
    brand?: string | null;
    description?: string | null;
    gtin?: string | null;
    category_id?: string | null;
  };
  categories?: CatRow[];
  apply?: boolean;
}): Promise<{ category_id: string | null; confidence: number; created: boolean }> {
  const { supabase, retailerId, userId, product, apply } = opts;
  let cats = opts.categories;
  if (!cats) {
    const { data } = await supabase
      .from("product_categories")
      .select("id, name, parent_id")
      .eq("retailer_id", retailerId);
    cats = (data ?? []) as CatRow[];
  }

  let picked: string | null = null;
  let confidence = 0;
  let created = false;

  const ai = await callAiCategoryPick({
    name: product.name,
    brand: product.brand,
    description: product.description,
    gtin: product.gtin,
    categories: cats!,
  });

  if (ai?.existing_category_id && cats!.some((c) => c.id === ai.existing_category_id)) {
    picked = ai.existing_category_id;
    confidence = ai.confidence;
  } else if (ai?.new_category) {
    // dedupe by lower-case name
    const existing = cats!.find(
      (c) => c.name.toLowerCase() === ai.new_category!.toLowerCase(),
    );
    if (existing) {
      picked = existing.id;
    } else {
      const { data: ins } = await supabase
        .from("product_categories")
        .insert({ retailer_id: retailerId, name: ai.new_category, created_by: userId ?? null })
        .select("id")
        .single();
      if (ins) {
        picked = ins.id;
        created = true;
      }
    }
    confidence = ai.confidence;
  }

  // Fallback: keyword mapper
  if (!picked) {
    const kw = keywordCategory(product.name, product.brand, product.description);
    if (kw) {
      const existing = cats!.find((c) => c.name.toLowerCase() === kw.toLowerCase());
      if (existing) picked = existing.id;
      else {
        const { data: ins } = await supabase
          .from("product_categories")
          .insert({ retailer_id: retailerId, name: kw, created_by: userId ?? null })
          .select("id")
          .single();
        if (ins) {
          picked = ins.id;
          created = true;
        }
      }
      confidence = 0.5;
    }
  }

  if (apply && product.id && picked) {
    // Only apply when the product is currently uncategorised
    if (!product.category_id) {
      await supabase
        .from("products")
        .update({
          category_id: picked,
          suggested_category_id: picked,
          category_confidence: confidence,
        })
        .eq("id", product.id);
    } else {
      // Product has a manual category — store as suggestion only
      if (picked !== product.category_id) {
        await supabase
          .from("products")
          .update({
            suggested_category_id: picked,
            category_confidence: confidence,
          })
          .eq("id", product.id);
      }
    }
  }

  return { category_id: picked, confidence, created };
}

export const bulkAutoCategorise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        onlyUncategorised: z.boolean().default(true),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    let q = supabase
      .from("products")
      .select("id, name, brand, description, gtin, category_id")
      .eq("retailer_id", retailerId)
      .neq("status", "archived")
      .limit(data.limit);
    if (data.onlyUncategorised) q = q.is("category_id", null);
    const { data: prods, error } = await q;
    if (error) throw new Error(error.message);
    const { data: cats } = await supabase
      .from("product_categories")
      .select("id, name, parent_id")
      .eq("retailer_id", retailerId);
    let processed = 0;
    let assigned = 0;
    for (const p of prods ?? []) {
      const res = await suggestCategoryForProduct({
        supabase,
        retailerId,
        userId,
        product: p,
        categories: cats ?? [],
        apply: true,
      });
      processed++;
      if (res.category_id) assigned++;
    }
    return { processed, assigned, total: prods?.length ?? 0 };
  });

export const applySuggestedCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p } = await supabase
      .from("products")
      .select("suggested_category_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!p?.suggested_category_id) throw new Error("No suggestion available");
    const { error } = await supabase
      .from("products")
      .update({ category_id: p.suggested_category_id })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dismissSuggestedCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ suggested_category_id: null, category_confidence: null })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveProductCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        categoryId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ category_id: data.categoryId })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
