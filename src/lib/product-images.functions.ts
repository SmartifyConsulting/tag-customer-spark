import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Re-run the image resolver for a product. Auth required. Retailer-scoped
// via RLS on the products SELECT below.
export const refreshProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: product } = await context.supabase
      .from("products")
      .select("id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!product) throw new Error("Product not found");
    const { resolveAndSyncProductImage } = await import("./product-images.server");
    const result = await resolveAndSyncProductImage({
      supabase: context.supabase,
      productId: data.productId,
    });
    return { ok: true, result };
  });

// Clear the current retailer image so the resolver can pick a fresh one on
// the next refresh (falls back to placeholder if nothing else is found).
export const resetProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({
        image_url: null,
        thumbnail_url: null,
        hero_image: null,
        image_status: "pending",
        image_source: null,
        image_gallery: [],
      })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    const { resolveAndSyncProductImage } = await import("./product-images.server");
    await resolveAndSyncProductImage({
      supabase: context.supabase,
      productId: data.productId,
    });
    return { ok: true };
  });
