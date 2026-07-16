import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles").select("retailer_id")
    .eq("user_id", userId).not("retailer_id", "is", null)
    .limit(1).maybeSingle();
  return data?.retailer_id ?? null;
}

export type NormalisedProduct = {
  display_name: string;
  brand: string | null;
  variant: string | null;
  size_value: number | null;
  size_unit: string | null;
  pack_count: number | null;
  flavour: string | null;
  category_hint: string | null;
  keywords: string[];
};

async function callAiNormalise(input: {
  raw_name: string;
  brand?: string | null;
  description?: string | null;
  gtin?: string | null;
}): Promise<NormalisedProduct | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const prompt = `Raw product:
name: ${input.raw_name}
brand: ${input.brand ?? ""}
description: ${input.description ?? ""}
gtin: ${input.gtin ?? ""}

Return a normalised JSON object with these exact fields:
{
 "display_name": "Title Case clean product name, no brand duplication, no size units",
 "brand": "Extracted brand in Title Case or null",
 "variant": "Flavour/type/style, e.g. 'Marie Caramel' or null",
 "size_value": number or null,
 "size_unit": "g|kg|ml|l|oz|lb|ct|pk|null",
 "pack_count": number or null,
 "flavour": string or null,
 "category_hint": "One or two words guiding categorisation e.g. 'Biscuits', 'Infant Cereal'",
 "keywords": ["3-6 short keywords for search"]
}
Rules: Title Case display_name. Do NOT include brand or size in display_name. Fix ALL CAPS. Extract '200g' → size_value 200 size_unit 'g'.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.4-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You normalise messy retail product data into clean structured JSON." },
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
      display_name: String(parsed.display_name ?? input.raw_name).trim(),
      brand: parsed.brand ?? null,
      variant: parsed.variant ?? null,
      size_value: parsed.size_value != null ? Number(parsed.size_value) : null,
      size_unit: parsed.size_unit ?? null,
      pack_count: parsed.pack_count != null ? Number(parsed.pack_count) : null,
      flavour: parsed.flavour ?? null,
      category_hint: parsed.category_hint ?? null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8).map(String) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Cheap fallback normaliser — Title Case + strip trailing size.
 */
function heuristicNormalise(input: { raw_name: string; brand?: string | null }): NormalisedProduct {
  let name = input.raw_name.trim().replace(/\s+/g, " ");
  // Extract trailing size like "200g" / "1.5L" / "6pk"
  let size_value: number | null = null;
  let size_unit: string | null = null;
  const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb|ct|pk)\b/i);
  if (sizeMatch) {
    size_value = Number(sizeMatch[1]);
    size_unit = sizeMatch[2].toLowerCase();
    name = name.replace(sizeMatch[0], "").trim();
  }
  // Title case
  const titled = name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+-\s+/g, " – ");
  return {
    display_name: titled || input.raw_name,
    brand: input.brand ?? null,
    variant: null,
    size_value,
    size_unit,
    pack_count: null,
    flavour: null,
    category_hint: null,
    keywords: [],
  };
}

export async function normaliseAndPersist(opts: {
  supabase: any;
  productId: string;
}): Promise<NormalisedProduct | null> {
  const { supabase, productId } = opts;
  const { data: p } = await supabase
    .from("products")
    .select("id, name, brand, description, gtin")
    .eq("id", productId)
    .maybeSingle();
  if (!p) return null;
  const ai = (await callAiNormalise({
    raw_name: p.name,
    brand: p.brand,
    description: p.description,
    gtin: p.gtin,
  })) ?? heuristicNormalise({ raw_name: p.name, brand: p.brand });
  await supabase
    .from("products")
    .update({
      display_name: ai.display_name,
      normalised_brand: ai.brand,
      variant: ai.variant,
      size_value: ai.size_value,
      size_unit: ai.size_unit,
      pack_count: ai.pack_count,
      normalised_at: new Date().toISOString(),
      normalisation_payload: ai as any,
    })
    .eq("id", productId);
  return ai;
}

export const normaliseProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const res = await normaliseAndPersist({ supabase: context.supabase, productId: data.productId });
    return { ok: !!res, result: res };
  });

export const bulkNormalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ onlyMissing: z.boolean().default(true), limit: z.number().int().min(1).max(200).default(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    let q = supabase
      .from("products")
      .select("id")
      .eq("retailer_id", retailerId)
      .neq("status", "archived")
      .limit(data.limit);
    if (data.onlyMissing) q = q.is("normalised_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let processed = 0;
    for (const r of rows ?? []) {
      const res = await normaliseAndPersist({ supabase, productId: r.id });
      if (res) processed++;
    }
    return { processed, total: rows?.length ?? 0 };
  });
