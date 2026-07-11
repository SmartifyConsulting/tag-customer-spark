import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Merge product taxonomy groups.
 * Re-points every product currently in `source_values` to `target_value`
 * for the given attribute. Scoped to the caller's retailer via RLS.
 */

const MERGEABLE = {
  brand: { column: "brand_id" },
  category: { column: "category_id" },
  subcategory: { column: "category_id" },
  store: { column: "store_id" },
  size: { column: "size" },
  colour: { column: "color" },
  variant: { column: "variant" },
} as const;

type MergeableKey = keyof typeof MERGEABLE;

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

export const isMergeableAttribute = (key: string): key is MergeableKey =>
  key in MERGEABLE;

export const mergeTaxonomyGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        attribute_key: z.enum([
          "brand",
          "category",
          "subcategory",
          "store",
          "size",
          "colour",
          "variant",
        ]),
        target_value: z.string().min(1),
        source_values: z.array(z.string().min(1)).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");

    const { attribute_key, target_value, source_values } = data;
    const spec = MERGEABLE[attribute_key as MergeableKey];
    const col = spec.column;

    // Never merge the target into itself.
    const sources = source_values.filter((v) => v !== target_value);
    if (sources.length === 0) return { updated: 0 };

    // Support the __none__ sentinel used by the browser.
    const nullSources = sources.filter((v) => v === "__none__");
    const realSources = sources.filter((v) => v !== "__none__");
    const targetIsNull = target_value === "__none__";
    const newValue = targetIsNull ? null : target_value;

    let updated = 0;

    if (realSources.length > 0) {
      const { data: rows, error } = await supabase
        .from("products")
        .update({ [col]: newValue })
        .eq("retailer_id", retailerId)
        .in(col, realSources)
        .select("id");
      if (error) throw new Error(error.message);
      updated += rows?.length ?? 0;
    }

    if (nullSources.length > 0 && !targetIsNull) {
      const { data: rows, error } = await supabase
        .from("products")
        .update({ [col]: newValue })
        .eq("retailer_id", retailerId)
        .is(col, null)
        .select("id");
      if (error) throw new Error(error.message);
      updated += rows?.length ?? 0;
    }

    // For brand/category, best-effort delete empty source rows now that
    // no products reference them. Ignore failures — foreign-key protection
    // will keep any still-referenced row intact.
    if (attribute_key === "brand" && realSources.length > 0) {
      await supabase.from("brands").delete().eq("retailer_id", retailerId).in("id", realSources);
    } else if ((attribute_key === "category" || attribute_key === "subcategory") && realSources.length > 0) {
      await supabase
        .from("product_categories")
        .delete()
        .eq("retailer_id", retailerId)
        .in("id", realSources);
    }

    return { updated };
  });
