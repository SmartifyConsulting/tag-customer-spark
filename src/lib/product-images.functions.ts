import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Small batch so a single page load never stalls on a run of slow/failing
// external lookups — the caller re-invokes this on each visit until the
// backlog clears.
const BACKFILL_BATCH = 8;

// Clear the current retailer image so the resolver can pick a fresh one on
// the next refresh (falls back to placeholder if nothing else is found).
export const resetProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
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

// Silently re-attempts image resolution for a small batch of products still
// stuck on a fallback image (brand logo or placeholder) — no UI trigger,
// meant to be called opportunistically (e.g. on Inventory Admin load) so a
// newly-configured image source (Open Food Facts / Serper / AI) gets a
// chance to backfill the existing catalogue over a few page visits.
export const backfillStaleProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("products")
      .select("id, image_url, image_status")
      .or("image_status.eq.placeholder,image_status.eq.brand_logo")
      .order("image_updated_at", { ascending: true, nullsFirst: true })
      .limit(BACKFILL_BATCH);
    if (error) throw new Error(error.message);

    const { resolveAndSyncProductImage } = await import("./product-images.server");
    let changed = 0;
    for (const row of rows ?? []) {
      const before = row.image_status;
      const result = await resolveAndSyncProductImage({ supabase, productId: row.id });
      if (result && result.image_status !== before) changed++;
    }
    return {
      processed: (rows ?? []).length,
      changed,
      remaining: (rows ?? []).length === BACKFILL_BATCH,
    };
  });
