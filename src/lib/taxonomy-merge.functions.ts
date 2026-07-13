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
  product_family: { column: "product_family" },
  supplier: { column: "supplier" },
  range: { column: "range_name" },
  collection: { column: "collection" },
  style: { column: "style" },
  season: { column: "season" },
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

export const isMergeableAttribute = (key: string): boolean =>
  key in MERGEABLE || key.startsWith("custom:");

export const mergeTaxonomyGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        attribute_key: z.string().refine((k) => isMergeableAttribute(k), {
          message: "Attribute is not mergeable",
        }),
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

    // Never merge the target into itself.
    const sources = source_values.filter((v) => v !== target_value);
    if (sources.length === 0) return { updated: 0 };

    // Support the __none__ sentinel used by the browser.
    const nullSources = sources.filter((v) => v === "__none__");
    const realSources = sources.filter((v) => v !== "__none__");
    const targetIsNull = target_value === "__none__";
    const newValue = targetIsNull ? null : target_value;

    // Custom (JSONB-backed) attributes can't be set via a plain column
    // update, so merge them by fetching + rewriting each matching row's
    // `custom_attributes` object individually.
    if (attribute_key.startsWith("custom:")) {
      const slug = attribute_key.slice("custom:".length);
      let updated = 0;
      const matchCol = `custom_attributes->>${slug}`;
      for (const src of realSources) {
        const { data: rows, error } = await (supabase as any)
          .from("products")
          .select("id, custom_attributes")
          .eq("retailer_id", retailerId)
          .eq(matchCol, src);
        if (error) throw new Error(error.message);
        for (const row of rows ?? []) {
          const attrs = { ...(row.custom_attributes ?? {}) };
          if (newValue == null) delete attrs[slug];
          else attrs[slug] = newValue;
          const { error: updErr } = await (supabase as any)
            .from("products")
            .update({ custom_attributes: attrs })
            .eq("id", row.id);
          if (updErr) throw new Error(updErr.message);
          updated++;
        }
      }
      if (realSources.length > 0) {
        await (supabase as any)
          .from("taxonomy_attribute_values")
          .delete()
          .eq("retailer_id", retailerId)
          .eq("attribute_key", attribute_key)
          .in("value", realSources);
      }
      return { updated };
    }

    const spec = MERGEABLE[attribute_key as MergeableKey];
    const col = spec.column;

    let updated = 0;

    if (realSources.length > 0) {
      const { data: rows, error } = await supabase
        .from("products")
        .update({ [col]: newValue } as any)
        .eq("retailer_id", retailerId)
        .in(col, realSources)
        .select("id");
      if (error) throw new Error(error.message);
      updated += rows?.length ?? 0;
    }

    if (nullSources.length > 0 && !targetIsNull) {
      const { data: rows, error } = await supabase
        .from("products")
        .update({ [col]: newValue } as any)
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
