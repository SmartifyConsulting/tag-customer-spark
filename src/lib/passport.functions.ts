import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProductPassport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase
      .from("product_passports")
      .select("*")
      .eq("product_id", data.product_id)
      .maybeSingle();
    return p;
  });

export const enrichProductPassportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        product_id: z.string().uuid(),
        overwrite: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // gate: caller must belong to retailer that owns this product
    const { data: prod } = await context.supabase
      .from("products")
      .select("id, retailer_id")
      .eq("id", data.product_id)
      .maybeSingle();
    if (!prod) throw new Error("Product not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enrichProductPassport } = await import("./passport.server");
    const result = await enrichProductPassport(supabaseAdmin, data.product_id, {
      overwrite: data.overwrite,
    });
    if (!result.ok) throw new Error(result.error);
    return result;
  });

// Re-runs AI enrichment (overwrite: true) for a batch of products — used by
// Admin > Inventory's "Re-enrich all" action, e.g. after an enrichment
// schema/prompt fix, to refresh passports that were already enriched under
// the old logic rather than waiting for someone to click "Re-enrich" on
// each product individually.
export const bulkReenrichPassports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ productIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enrichProductPassport } = await import("./passport.server");
    let succeeded = 0;
    const errors: Array<{ productId: string; message: string }> = [];
    for (const productId of data.productIds) {
      const r = await enrichProductPassport(supabaseAdmin, productId, { overwrite: true });
      if (r.ok) succeeded++;
      else errors.push({ productId, message: r.error });
    }
    return { succeeded, errors };
  });

export const updateProductPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        product_id: z.string().uuid(),
        patch: z.record(z.string(), z.any()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const allowed = new Set([
      "brand",
      "manufacturer",
      "country_of_origin",
      "category_path",
      "short_description",
      "marketing_description",
      "product_summary",
      "consumer_faqs",
      "ingredients",
      "nutrition",
      "allergens",
      "dimensions",
      "materials",
      "warranty",
      "sustainability",
      "images",
    ]);
    const patch: any = { enrichment_status: "manual", last_edited_by: context.userId };
    for (const [k, v] of Object.entries(data.patch)) if (allowed.has(k)) patch[k] = v;

    const { error } = await context.supabase
      .from("product_passports")
      .update(patch)
      .eq("product_id", data.product_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
