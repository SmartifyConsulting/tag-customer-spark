// Server-only helpers for Digital Product Passport enrichment.
import { z } from "zod";

// NOTE: every field here is `.nullable()` rather than `.optional()`, and no
// field or nested object uses `.default()`. OpenAI's strict structured-output
// mode requires the JSON schema `required` array to list every key in
// `properties` — zod-to-json-schema drops `.optional()`/`.default()` fields
// from `required`, which strict mode then rejects (e.g. "Missing
// 'height_mm'"). `.nullable()` keeps the key required while still letting
// the model return null for anything it can't ground.
const passportSchema = z.object({
  brand: z.string().nullable(),
  manufacturer: z.string().nullable(),
  country_of_origin: z.string().nullable(),
  category_path: z.string().nullable(),
  short_description: z.string().nullable(),
  marketing_description: z.string().nullable(),
  product_summary: z.string().nullable(),
  consumer_faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  ingredients: z.array(z.string()),
  nutrition: z.object({
    serving_size: z.string().nullable(),
    calories_kcal: z.number().nullable(),
    protein_g: z.number().nullable(),
    carbs_g: z.number().nullable(),
    sugar_g: z.number().nullable(),
    fat_g: z.number().nullable(),
    saturated_fat_g: z.number().nullable(),
    salt_g: z.number().nullable(),
    fibre_g: z.number().nullable(),
  }),
  allergens: z.array(z.string()),
  dimensions: z.object({
    length_mm: z.number().nullable(),
    width_mm: z.number().nullable(),
    height_mm: z.number().nullable(),
    weight_g: z.number().nullable(),
  }),
  materials: z.array(z.string()),
  warranty: z.object({
    duration_months: z.number().nullable(),
    terms: z.string().nullable(),
  }),
  sustainability: z.object({
    recyclable: z.boolean().nullable(),
    certifications: z.array(z.string()),
    packaging: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  images: z.array(
    z.object({
      // Plain string, not .url() — OpenAI's strict structured-output mode
      // only supports a fixed set of JSON Schema `format` values
      // (date-time, email, uuid, etc.); zod-to-json-schema emits "uri" for
      // .url(), which isn't in that set and made every enrichment call
      // fail schema validation before the model ever ran.
      url: z.string(),
      role: z.string(),
      source: z.string().nullable(),
      license: z.string().nullable(),
    }),
  ),
  field_confidence: z.record(z.string(), z.number().min(0).max(1)),
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

// --- Web search grounding (Serper) ---------------------------------------
// Open Food Facts only covers groceries, so anything outside that (most
// non-food retail: appliances, toys, tools, electronics) previously had
// nothing but the AI's own unaided knowledge to work from. A handful of web
// search snippets gives the model real, current text to ground dimensions,
// materials, warranty and country-of-origin claims in — same Serper key the
// image resolver already uses.
async function fetchSerperWebResults(query: string): Promise<Array<{ title: string; snippet: string; link: string }>> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey || query.length < 3) return [];
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const organic: any[] = Array.isArray(json?.organic) ? json.organic : [];
    return organic.slice(0, 5).map((r) => ({
      title: String(r?.title ?? ""),
      snippet: String(r?.snippet ?? ""),
      link: String(r?.link ?? ""),
    }));
  } catch {
    return [];
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
  webResults: Array<{ title: string; snippet: string; link: string }>;
}): Promise<EnrichedPassport> {
  const { generateObject } = await import("ai");
  const { getGatewayFromEnv } = await import("./ai-gateway.server");
  const gateway = getGatewayFromEnv(undefined, { structuredOutputs: true });
  const model = gateway("openai/gpt-5.5");

  const prompt = `Enrich the following product into a Digital Product Passport.
Use the lookup data and web search results as ground truth when present. For any field you cannot ground in the lookup, the web search snippets, or common, verifiable public knowledge about this exact GTIN/brand/product, return null and DO NOT invent.

Product:
- Name: ${input.name}
- Brand: ${input.brand ?? "unknown"}
- GTIN: ${input.gtin ?? "unknown"}
- Category hint: ${input.category ?? "unknown"}
- Existing description: ${input.description ?? "none"}

Lookup data (Open Food Facts, may be null):
${input.lookup ? JSON.stringify(input.lookup).slice(0, 4000) : "none"}

Web search results (title / snippet / source URL, may be empty):
${input.webResults.length ? input.webResults.map((r) => `- ${r.title}: ${r.snippet} (${r.link})`).join("\n").slice(0, 4000) : "none"}

Rules:
- Only populate nutrition / ingredients / allergens for consumable products.
- Use the web search snippets primarily for: dimensions, weight, materials, country of origin, warranty terms, sustainability/certifications — fields Open Food Facts never covers.
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
      "id, retailer_id, name, brand, description, gtin, digital_product_passport_id, category:product_categories!products_category_id_fkey(name)",
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
    const webQuery = [product.brand, product.name, product.gtin].filter(Boolean).join(" ").trim();
    const webResults = await fetchSerperWebResults(webQuery);
    const enriched = await callEnrichmentAI({
      name: product.name,
      brand: product.brand,
      gtin: product.gtin,
      description: product.description,
      category: product.category?.name,
      lookup,
      webResults,
    });

    const sources = [
      ...(lookupSource ? [lookupSource] : []),
      ...(webResults.length
        ? [{ provider: "serper-web", query: webQuery, fetched_at: new Date().toISOString() }]
        : []),
      { provider: "lovable-ai", model: "openai/gpt-5.5", generated_at: new Date().toISOString() },
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
      enrichment_model: "openai/gpt-5.5",
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

// Canonical public product URL — this is what the QR encodes. It's a normal
// public page (never an API endpoint) so scans open directly to the Digital
// Product Passport with no redirect hop. POS scanners still parse the GTIN
// out of the /products/{gtin} path segment identically to a linear scan.
export function resolverUrlForGtin(gtin14: string): string {
  return `${getPublicSiteBase()}/passport/${gtin14}`;
}
