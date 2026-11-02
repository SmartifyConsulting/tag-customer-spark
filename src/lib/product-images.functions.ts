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

// "Re-enrich product image": searches afresh for this product's photo, ignoring
// the shared catalogue and the "nothing found" memory (an explicit refresh is
// the one time we pay to look again). A photo the retailer uploaded themselves
// is only replaced after they confirm; a real photo is never swapped for a
// worse fallback.
export const refreshProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ productId: z.string().uuid(), replaceRetailerPhoto: z.boolean().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    {
      const u = await import("./usage-context.server");
      u.setUsageUser(context.userId);
      u.setRunLabel("Re-enrich image");
    }
    const { supabase } = context;
    const { data: cur, error } = await supabase
      .from("products")
      .select("image_status")
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cur) throw new Error("Product not found");

    if (cur.image_status === "retailer") {
      if (!data.replaceRetailerPhoto) return { ok: false as const, needsConfirm: true as const };
      // Clear the uploaded photo so the resolver doesn't just keep it.
      const { error: clearErr } = await supabase
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
      if (clearErr) throw new Error(clearErr.message);
    }

    const { resolveAndSyncProductImage } = await import("./product-images.server");
    const result = await resolveAndSyncProductImage({
      supabase,
      productId: data.productId,
      force: true,
    });
    if (!result) return { ok: true as const, kept: true as const };
    return { ok: true as const, kept: false as const, status: result.image_status, source: result.image_source };
  });

// Silently re-attempts image resolution for a small batch of products still
// stuck on a fallback image (brand logo or placeholder) — no UI trigger,
// meant to be called opportunistically (e.g. on Inventory Admin load) so a
// newly-configured image source (Open Food Facts / Serper / AI) gets a
// chance to backfill the existing catalogue over a few page visits.
export const backfillStaleProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    {
      const u = await import("./usage-context.server");
      u.setUsageUser(context.userId);
      u.setRunLabel("Image backfill");
    }
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
      // Best-effort per row — resolveAndSyncProductImage now throws instead
      // of silently returning null on failure (so callers that DO want to
      // see the error, like the manual refresh button, finally can). This
      // loop still shouldn't let one bad product abort the rest of the
      // batch, so it's caught and skipped here same as before.
      try {
        const result = await resolveAndSyncProductImage({ supabase, productId: row.id });
        if (result && result.image_status !== before) changed++;
      } catch {
        /* skip — next visit's batch will retry it */
      }
    }
    return {
      processed: (rows ?? []).length,
      changed,
      remaining: (rows ?? []).length === BACKFILL_BATCH,
    };
  });
