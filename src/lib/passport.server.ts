// Server-only helpers for Digital Product Passport enrichment.
import { z } from "zod";

const passportSchema = z.object({
  brand: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  country_of_origin: z.string().nullable().optional(),
  category_path: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  marketing_description: z.string().nullable().optional(),
  product_summary: z.string().nullable().optional(),
  consumer_faqs: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
  ingredients: z.array(z.string()).default([]),
  nutrition: z
    .object({
      serving_size: z.string().nullable().optional(),
      calories_kcal: z.number().nullable().optional(),
      protein_g: z.number().nullable().optional(),
      carbs_g: z.number().nullable().optional(),
      sugar_g: z.number().nullable().optional(),
      fat_g: z.number().nullable().optional(),
      saturated_fat_g: z.number().nullable().optional(),
      salt_g: z.number().nullable().optional(),
      fibre_g: z.number().nullable().optional(),
    })
    .default({}),
  allergens: z.array(z.string()).default([]),
  dimensions: z
    .object({
      length_mm: z.number().nullable().optional(),
      width_mm: z.number().nullable().optional(),
      height_mm: z.number().nullable().optional(),
      weight_g: z.number().nullable().optional(),
    })
    .default({}),
  materials: z.array(z.string()).default([]),
  warranty: z
    .object({
      duration_months: z.number().nullable().optional(),
      terms: z.string().nullable().optional(),
    })
    .default({}),
  sustainability: z
    .object({
      recyclable: z.boolean().nullable().optional(),
      certifications: z.array(z.string()).default([]),
      packaging: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .default({}),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        role: z.string().default("gallery"),
        source: z.string().nullable().optional(),
        license: z.string().nullable().optional(),
      }),
    )
    .default([]),
  field_confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
});

export type EnrichedPassport = z.infer<typeof passportSchema>;

// --- Deterministic lookup: Open Food Facts by GTIN ----------------------
async function fetchOpenFoodFacts(gtin: string | null): Promise<{
  hit: any | null;
  source: any;
}> {
  if (!gtin) return { hit: null, source: null };
  const digits = gtin.replace(/^0+/, "") || gtin;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${digits}.json`, {
      headers: { "User-Agent": "TAG-DPP/1.0" },
    });
    if (!res.ok) return { hit: null, source: null };
    const json = (await res.json()) as any;
    if (json?.status !== 1 || !json.product) return { hit: null, source: null };
    const p = json.product;
    return {
      hit: {
        brand: p.brands ?? null,
        product_name: p.product_name ?? null,
        generic_name: p.generic_name ?? null,
        categories: p.categories ?? null,
        countries: p.countries ?? null,
        manufacturing_places: p.manufacturing_places ?? null,
        ingredients_text: p.ingredients_text ?? null,
        allergens_tags: p.allergens_tags ?? [],
        nutriments: p.nutriments ?? {},
        image_url: p.image_url ?? null,
        image_ingredients_url: p.image_ingredients_url ?? null,
        image_nutrition_url: p.image_nutrition_url ?? null,
      },
      source: {
        provider: "openfoodfacts",
        url: `https://world.openfoodfacts.org/product/${digits}`,
        fetched_at: new Date().toISOString(),
      },
    };
  } catch {
    return { hit: null, source: null };
  }
}

// --- AI enrichment -------------------------------------------------------
async function callEnrichmentAI(input: {
  name: string;
  brand?: string | null;
  gtin?: string | null;
  description?: string | null;
  category?: string | null;
  lookup: any | null;
}): Promise<EnrichedPassport> {
  const { generateObject } = await import("ai");
  const { getGatewayFromEnv } = await import("./ai-gateway.server");
  const gateway = getGatewayFromEnv();
  const model = gateway("google/gemini-3-flash-preview");

  const prompt = `Enrich the following product into a Digital Product Passport.
Use the lookup data as ground truth when present. For any field you cannot ground in the lookup or common, verifiable public knowledge about this exact GTIN/brand/product, return null and DO NOT invent.

Product:
- Name: ${input.name}
- Brand: ${input.brand ?? "unknown"}
- GTIN: ${input.gtin ?? "unknown"}
- Category hint: ${input.category ?? "unknown"}
- Existing description: ${input.description ?? "none"}

Lookup data (Open Food Facts, may be null):
${input.lookup ? JSON.stringify(input.lookup).slice(0, 4000) : "none"}

Rules:
- Only populate nutrition / ingredients / allergens for consumable products.
- consumer_faqs: 3-5 short shopper questions with concise answers.
- marketing_description: 1 paragraph, evocative but truthful.
- product_summary: 1-2 sentence factual summary.
- images: only include URLs present in lookup data (do not invent URLs).
- field_confidence: map each populated field name to 0-1 confidence.
- Return only valid data matching the schema; nulls are fine.`;

  try {
    const { object } = await generateObject({
      model,
      schema: passportSchema as any,
      prompt,
      system:
        "You produce factual Digital Product Passport data. Prefer null over guessing. Never invent GTINs, URLs, or certifications.",
    });
    return object as EnrichedPassport;
  } catch (e: any) {
    const msg = e?.message ?? "AI enrichment failed";
    if (msg.includes("429")) throw new Error("AI rate limit hit — retry shortly.");
    if (msg.includes("402")) throw new Error("AI credits exhausted.");
    throw new Error(msg);
  }
}

export async function enrichProductPassport(
  supabaseAdmin: any,
  productId: string,
  opts: { overwrite?: boolean } = {},
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const { data: product, error: pErr } = await supabaseAdmin
    .from("products")
    .select(
      "id, retailer_id, name, brand, description, gtin, digital_product_passport_id, category:product_categories(name)",
    )
    .eq("id", productId)
    .maybeSingle();
  if (pErr || !product) return { ok: false, error: pErr?.message ?? "Product not found" };

  // mark queue attempt
  await supabaseAdmin.from("passport_enrichment_queue").upsert({
    product_id: productId,
    retailer_id: product.retailer_id,
    last_attempt_at: new Date().toISOString(),
  });

  // Existing passport (preserve manual edits unless overwrite)
  const { data: existing } = await supabaseAdmin
    .from("product_passports")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (existing?.enrichment_status === "manual" && !opts.overwrite) {
    await supabaseAdmin.from("passport_enrichment_queue").delete().eq("product_id", productId);
    return { ok: true, status: "manual-preserved" };
  }

  try {
    await supabaseAdmin
      .from("product_passports")
      .upsert(
        {
          product_id: productId,
          retailer_id: product.retailer_id,
          dpp_id: product.digital_product_passport_id,
          gtin: product.gtin ?? null,
          enrichment_status: "enriching",
        },
        { onConflict: "product_id" },
      );

    const { hit: lookup, source: lookupSource } = await fetchOpenFoodFacts(product.gtin);
    const enriched = await callEnrichmentAI({
      name: product.name,
      brand: product.brand,
      gtin: product.gtin,
      description: product.description,
      category: product.category?.name,
      lookup,
    });

    const sources = [
      ...(lookupSource ? [lookupSource] : []),
      { provider: "lovable-ai", model: "google/gemini-3-flash-preview", generated_at: new Date().toISOString() },
    ];

    // Merge: never blank a field that already has a value unless overwrite
    const merge = <T>(newVal: T, oldVal: T): T => {
      if (opts.overwrite) return newVal ?? oldVal;
      if (newVal === null || newVal === undefined || newVal === "") return oldVal;
      if (Array.isArray(newVal) && newVal.length === 0) return oldVal;
      if (typeof newVal === "object" && newVal !== null && Object.keys(newVal as any).length === 0)
        return oldVal;
      return newVal;
    };

    const row: any = {
      product_id: productId,
      retailer_id: product.retailer_id,
      dpp_id: product.digital_product_passport_id,
      gtin: product.gtin ?? null,
      brand: merge(enriched.brand ?? product.brand ?? null, existing?.brand ?? null),
      manufacturer: merge(enriched.manufacturer ?? null, existing?.manufacturer ?? null),
      country_of_origin: merge(enriched.country_of_origin ?? null, existing?.country_of_origin ?? null),
      category_path: merge(enriched.category_path ?? product.category?.name ?? null, existing?.category_path ?? null),
      short_description: merge(enriched.short_description ?? null, existing?.short_description ?? null),
      marketing_description: merge(enriched.marketing_description ?? null, existing?.marketing_description ?? null),
      product_summary: merge(enriched.product_summary ?? null, existing?.product_summary ?? null),
      consumer_faqs: merge(enriched.consumer_faqs, existing?.consumer_faqs ?? []),
      ingredients: merge(enriched.ingredients, existing?.ingredients ?? []),
      nutrition: merge(enriched.nutrition, existing?.nutrition ?? {}),
      allergens: merge(enriched.allergens, existing?.allergens ?? []),
      dimensions: merge(enriched.dimensions, existing?.dimensions ?? {}),
      materials: merge(enriched.materials, existing?.materials ?? []),
      warranty: merge(enriched.warranty, existing?.warranty ?? {}),
      sustainability: merge(enriched.sustainability, existing?.sustainability ?? {}),
      images: merge(enriched.images, existing?.images ?? []),
      sources,
      field_confidence: enriched.field_confidence ?? {},
      enrichment_status: "enriched",
      enrichment_model: "google/gemini-3-flash-preview",
      enriched_at: new Date().toISOString(),
      version: (existing?.version ?? 0) + 1,
    };

    await supabaseAdmin
      .from("product_passports")
      .upsert(row, { onConflict: "product_id" });

    await supabaseAdmin.from("passport_enrichment_queue").delete().eq("product_id", productId);
    return { ok: true, status: "enriched" };
  } catch (e: any) {
    await supabaseAdmin
      .from("product_passports")
      .upsert(
        {
          product_id: productId,
          retailer_id: product.retailer_id,
          dpp_id: product.digital_product_passport_id,
          enrichment_status: "failed",
        },
        { onConflict: "product_id" },
      );
    await supabaseAdmin
      .from("passport_enrichment_queue")
      .upsert({
        product_id: productId,
        retailer_id: product.retailer_id,
        last_attempt_at: new Date().toISOString(),
        last_error: (e?.message ?? "unknown").slice(0, 500),
        attempts: 0, // increment via SQL if desired; keep simple for now
      });
    return { ok: false, error: e?.message ?? "enrichment failed" };
  }
}

export function getPublicSiteBase(): string {
  return (
    process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://tag-customer-spark.lovable.app"
  );
}

// Canonical GS1 Digital Link for a GTIN — routed through our resolver so the
// same QR resolves to the Digital Product Passport for humans but stays a
// conformant GS1 Digital Link (AI 01) for POS scanners.
export function resolverUrlForGtin(gtin14: string): string {
  return `${getPublicSiteBase()}/api/public/01/${gtin14}`;
}
