import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { productInputSchema, listProductsSchema } from "./products.schemas";

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

async function canManage(supabase: any, userId: string, retailerId: string) {
  const { data } = await supabase.rpc("can_manage_retailer", {
    _user_id: userId,
    _retailer_id: retailerId,
  });
  return Boolean(data);
}

export const getProductFormOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { categories: [], stores: [], retailerId: null };
    const [{ data: cats }, { data: stores }] = await Promise.all([
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("retailer_id", retailerId)
        .order("name"),
      supabase.from("stores").select("id, name").eq("retailer_id", retailerId).order("name"),
    ]);
    return { categories: cats ?? [], stores: stores ?? [], retailerId };
  });

export const lookupBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().trim().min(3).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { found: false, source: "none" as const };

    const { data: local } = await supabase
      .from("products")
      .select(
        "id, name, sku, brand, description, price_cents, sale_price_cents, currency, stock_qty, low_stock_threshold, color, size, image_url, category_id, store_id",
      )
      .eq("retailer_id", retailerId)
      .eq("sku", data.code)
      .maybeSingle();
    if (local) return { found: true, source: "local" as const, product: local };

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(data.code)}.json`,
        { headers: { "user-agent": "tag-app/1.0" } },
      );
      if (res.ok) {
        const json: any = await res.json();
        if (json?.status === 1 && json.product) {
          const p = json.product;
          return {
            found: true,
            source: "off" as const,
            product: {
              name: p.product_name ?? p.generic_name ?? null,
              brand: (p.brands ?? "").split(",")[0]?.trim() || null,
              description: p.ingredients_text ?? null,
              image_url: p.image_url ?? p.image_front_url ?? null,
              size: p.quantity ?? null,
            },
          };
        }
      }
    } catch {}

    return { found: false, source: "none" as const };
  });

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listProductsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("products")
      .select(
        "id, name, sku, brand, status, price_cents, sale_price_cents, currency, stock_qty, low_stock_threshold, images, image_url, promotion_start_date, promotion_end_date, color, size, updated_at, intent_score, intent_score_trend, intent_score_confidence, category:product_categories!products_category_id_fkey(id,name), store:stores(id,name)",
        { count: "exact" },
      );

    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,brand.ilike.%${s}%`);
    }
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.category_id) q = q.eq("category_id", data.category_id);
    if (data.brand_id) q = q.eq("brand_id", data.brand_id);
    if (data.store_id) q = q.eq("store_id", data.store_id);
    // A product is "tagged" once a GS1 QR asset has been generated for it.
    const { data: qrRows } = await supabase.from("product_qr_assets").select("product_id");
    const taggedIds = new Set<string>((qrRows ?? []).map((r: any) => r.product_id));
    if (data.tagged === "tagged") {
      q = q.in(
        "id",
        taggedIds.size ? Array.from(taggedIds) : ["00000000-0000-0000-0000-000000000000"],
      );
    } else if (data.tagged === "untagged" && taggedIds.size) {
      q = q.not("id", "in", `(${Array.from(taggedIds).join(",")})`);
    }
    if (data.promotion) {
      const now = new Date().toISOString();
      q = q
        .not("promotion_start_date", "is", null)
        .lte("promotion_start_date", now)
        .gte("promotion_end_date", now);
    }
    if (data.low_stock) {
      // Postgres can't compare two columns via PostgREST; fetch then filter client-side below
      q = q.lte("stock_qty", 9999);
    }

    switch (data.sort) {
      case "name":
        q = q.order("name", { ascending: true });
        break;
      case "price":
        q = q.order("price_cents", { ascending: true });
        break;
      case "stock":
        q = q.order("stock_qty", { ascending: true });
        break;
      default:
        q = q.order("updated_at", { ascending: false });
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    let filtered = rows ?? [];
    if (data.low_stock) {
      filtered = filtered.filter((p: any) => p.stock_qty <= (p.low_stock_threshold ?? 0));
    }
    filtered = filtered.map((p: any) => ({ ...p, is_tagged: taggedIds.has(p.id) }));

    return {
      rows: filtered,
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: product, error } = await supabase
      .from("products")
      .select(
        "*, category:product_categories!products_category_id_fkey(id,name), store:stores(id,name), retailer:retailers(id,name,logo_url)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Product not found");

    // Auto-heal image for legacy products whose resolver never ran.
    if (!product.image_status || product.image_status === "pending") {
      try {
        const { resolveAndSyncProductImage } = await import("./product-images.server");
        const healed = await resolveAndSyncProductImage({ supabase, productId: data.id });
        if (healed) {
          (product as any).image_url = healed.image_url;
          (product as any).thumbnail_url = healed.thumbnail_url;
          (product as any).hero_image = healed.hero_image;
          (product as any).image_status = healed.image_status;
          (product as any).image_source = healed.image_source;
          (product as any).image_gallery = healed.image_gallery;
        }
      } catch {
        /* best-effort heal */
      }
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: qr },
      { data: passport },
      { count: scans30 },
      { count: scansTotal },

      { count: interestedCount },
      { count: notifSent },
      { data: recoveries },
      { data: trend },
    ] = await Promise.all([
      supabase
        .from("product_qr_assets")
        .select(
          "id, product_id, gtin, status, version, generated_at, resolver_url, digital_link_url, png_path, svg_path",
        )
        .eq("product_id", data.id)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("product_passports")
        .select("dpp_id, status, enrichment_status, visibility, updated_at")
        .eq("product_id", data.id)
        .maybeSingle(),

      supabase
        .from("qr_scans")
        .select("id", { count: "exact", head: true })
        .eq("product_id", data.id)
        .gte("scanned_at", since),
      supabase
        .from("qr_scans")
        .select("id", { count: "exact", head: true })
        .eq("product_id", data.id),
      supabase
        .from("customer_interests")
        .select("id", { count: "exact", head: true })
        .eq("product_id", data.id)
        .eq("status", "active"),
      supabase
        .from("notification_history")
        .select("id, campaign:notification_campaigns!inner(product_id)", {
          count: "exact",
          head: true,
        })
        .eq("campaign.product_id", data.id),
      supabase
        .from("sales_recoveries")
        .select("amount_cents, currency")
        .eq("product_id", data.id)
        .eq("status", "attributed"),
      supabase
        .from("qr_scans")
        .select("scanned_at, device_type")
        .eq("product_id", data.id)
        .gte("scanned_at", since)
        .order("scanned_at", { ascending: true }),
    ]);

    const recoveredCents = (recoveries ?? []).reduce(
      (a: number, r: any) => a + (r.amount_cents ?? 0),
      0,
    );

    // Build daily trend buckets
    const buckets = new Map<string, number>();
    const deviceCounts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    (trend ?? []).forEach((row: any) => {
      const key = String(row.scanned_at).slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      const dev = row.device_type ?? "unknown";
      deviceCounts[dev] = (deviceCounts[dev] ?? 0) + 1;
    });

    const storageBase =
      (process.env.SUPABASE_URL ?? "").replace(/\/$/, "") +
      "/storage/v1/object/public/qr-artifacts/";
    const qrEnriched = qr
      ? {
          ...qr,
          png_url: storageBase + (qr as any).png_path,
          svg_url: storageBase + (qr as any).svg_path,
        }
      : null;

    return {
      product,
      qr: qrEnriched,
      passport: passport ?? null,
      analytics: {
        scans30: scans30 ?? 0,
        scansTotal: scansTotal ?? 0,
        interestedCount: interestedCount ?? 0,
        notifSent: notifSent ?? 0,
        recoveredCents,
        currency: (recoveries?.[0] as any)?.currency ?? product.currency ?? "ZAR",
        trend: Array.from(buckets, ([date, count]) => ({ date, count })),
        deviceCounts,
      },
    };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned to your account");
    if (!(await canManage(supabase, userId, retailerId)))
      throw new Error("You don't have permission to add products");
    const insertPayload: any = {
      ...data,
      retailer_id: retailerId,
      created_by: userId,
      image_url: data.images[0]?.url ?? null,
    };
    const { data: row, error } = await supabase
      .from("products")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!(data as any).category_id) {
      try {
        const { suggestCategoryForProduct } = await import("./categories.functions");
        await suggestCategoryForProduct({
          supabase,
          retailerId,
          userId,
          product: {
            id: row.id,
            name: (data as any).name,
            brand: (data as any).brand,
            description: (data as any).description,
            gtin: (data as any).gtin,
            category_id: null,
          },
          apply: true,
        });
      } catch {
        // non-fatal
      }
    }

    // The manual "Add Product" form has no barcode field, so a product
    // created here always starts with no GTIN — same gap import used to
    // have before commitProductImport ran the barcode-to-QR pipeline
    // inline. Do the same here, non-fatally, so a manually-added product
    // shows up as tagged in Inventory without a separate manual step.
    try {
      const { assignMissingBarcodesForRetailer } = await import("./barcode-assign.functions");
      await assignMissingBarcodesForRetailer(supabase, retailerId);
      const { generateForProduct } = await import("./qr.functions");
      const { resolveAndSyncProductImage } = await import("./product-images.server");
      await generateForProduct(supabase, userId, row.id, false);
      await resolveAndSyncProductImage({ supabase, productId: row.id });
    } catch {
      // non-fatal — the retailer can still run Tag Intelligence manually.
    }

    return { id: row.id as string };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: productInputSchema.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = { ...data.patch };
    if (data.patch.images && data.patch.images.length) patch.image_url = data.patch.images[0].url;
    const { error } = await supabase.from("products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    if ("price_cents" in patch || "sale_price_cents" in patch || "stock_qty" in patch) {
      const { processWatchlistEvents } = await import("@/lib/watchlist-dispatch.server");
      processWatchlistEvents(supabase, data.id).catch((e) =>
        console.warn("[updateProduct] watchlist dispatch failed", e?.message ?? e),
      );
    }

    return { ok: true };
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ status: "archived" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkDeleteProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error, count } = await context.supabase
      .from("products")
      .delete({ count: "exact" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: count ?? data.ids.length };
  });

// ---------- Duplicate product detection + merge ----------
// SKU is already unique per retailer at the DB level, so real-world
// duplicates show up as two rows sharing the same GTIN/barcode (e.g. the
// same item scanned in twice). We group on GTIN only.

export const findDuplicateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ categoryId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { groups: [] };

    let q = supabase
      .from("products")
      .select(
        "id, name, display_name, sku, gtin, stock_qty, price_cents, currency, image_url, thumbnail_url",
      )
      .eq("retailer_id", retailerId)
      .neq("status", "archived")
      .not("gtin", "is", null);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const byGtin = new Map<string, any[]>();
    for (const p of rows ?? []) {
      const key = String(p.gtin).trim();
      if (!key) continue;
      if (!byGtin.has(key)) byGtin.set(key, []);
      byGtin.get(key)!.push(p);
    }

    const groups = Array.from(byGtin.entries())
      .filter(([, list]) => list.length >= 2)
      .map(([gtin, list]) => ({
        gtin,
        products: list
          .map((p) => ({
            id: p.id,
            name: p.display_name || p.name,
            sku: p.sku,
            stock_qty: p.stock_qty,
            price_cents: p.price_cents,
            currency: p.currency,
            image_url: p.thumbnail_url || p.image_url,
          }))
          .sort((a, b) => (b.stock_qty ?? 0) - (a.stock_qty ?? 0)),
      }));

    return { groups };
  });

export const mergeProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targetId: z.string().uuid(),
        sourceIds: z.array(z.string().uuid()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const sourceIds = data.sourceIds.filter((id) => id !== data.targetId);
    if (sourceIds.length === 0) return { merged: 0 };

    const { data: rows, error: fetchErr } = await supabase
      .from("products")
      .select("id, stock_qty")
      .eq("retailer_id", retailerId)
      .in("id", [data.targetId, ...sourceIds]);
    if (fetchErr) throw new Error(fetchErr.message);

    const target = rows?.find((r: any) => r.id === data.targetId);
    if (!target) throw new Error("Target product not found");
    const addedStock = (rows ?? [])
      .filter((r: any) => sourceIds.includes(r.id))
      .reduce((sum: number, r: any) => sum + (r.stock_qty ?? 0), 0);

    // Preserve history (passport scans, order lines, etc. all cascade off
    // products.id) by archiving the merged-away rows instead of deleting
    // them — only the target stays active/visible.
    const { error: targetErr } = await supabase
      .from("products")
      .update({ stock_qty: (target.stock_qty ?? 0) + addedStock })
      .eq("id", data.targetId)
      .eq("retailer_id", retailerId);
    if (targetErr) throw new Error(targetErr.message);

    const { error: archiveErr } = await supabase
      .from("products")
      .update({ status: "archived", stock_qty: 0 })
      .in("id", sourceIds)
      .eq("retailer_id", retailerId);
    if (archiveErr) throw new Error(archiveErr.message);

    return { merged: sourceIds.length };
  });

export const createProductImageUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid().optional(),
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");
    if (!(await canManage(supabase, userId, retailerId))) throw new Error("Not permitted");

    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const id = crypto.randomUUID();
    const path = `${retailerId}/${data.productId ?? "drafts"}/${id}-${safe}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);

    return {
      path,
      uploadUrl: signed.signedUrl,
      token: signed.token,
      publicUrl: pub.publicUrl,
    };
  });

export const setProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        images: z.array(
          z.object({ url: z.string().url(), path: z.string(), sort: z.number().int() }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ images: data.images, image_url: data.images[0]?.url ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stock_qty: z.number().int().min(0).max(999999),
        low_stock_threshold: z.number().int().min(0).max(999999).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { stock_qty: number; low_stock_threshold?: number } = {
      stock_qty: data.stock_qty,
    };
    if (data.low_stock_threshold !== undefined)
      patch.low_stock_threshold = data.low_stock_threshold;
    const { error } = await context.supabase.from("products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    const { processWatchlistEvents } = await import("@/lib/watchlist-dispatch.server");
    processWatchlistEvents(context.supabase, data.id).catch((e) =>
      console.warn("[updateStock] watchlist dispatch failed", e?.message ?? e),
    );

    return { ok: true };
  });

export const listStockOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filter: z.enum(["all", "low", "out"]).default("all"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("products")
      .select(
        "id, name, sku, image_url, stock_qty, low_stock_threshold, status, store:stores(id,name)",
      )
      .eq("status", "active")
      .order("stock_qty", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = (rows ?? []).filter((p: any) => {
      if (data.filter === "out") return (p.stock_qty ?? 0) <= 0;
      if (data.filter === "low")
        return (p.stock_qty ?? 0) > 0 && (p.stock_qty ?? 0) <= (p.low_stock_threshold ?? 0);
      return true;
    });
    return list;
  });

// Bulk "Complete digital identity" — runs QR + image + passport enrichment
// across many products in parallel. Skips products missing a GTIN.
export const bulkCompleteDigitalIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productIds: z.array(z.string().uuid()).min(1).max(50),
        force: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { generateForProduct, isValidGtin } = await import("./qr.functions");
    const { resolveAndSyncProductImage } = await import("./product-images.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enrichProductPassport } = await import("./passport.server");
    const { normaliseAndPersist } = await import("./normalisation.functions");

    const results = {
      succeeded: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ productId: string; step: string; message: string }>,
    };

    const runOne = async (pid: string) => {
      try {
        const { data: p } = await supabase
          .from("products")
          .select("id, gtin, image_status, normalised_at")
          .eq("id", pid)
          .maybeSingle();
        if (!p) {
          results.skipped++;
          return;
        }
        const gtin = String(p.gtin ?? "").trim();
        if (!gtin || !isValidGtin(gtin)) {
          results.skipped++;
          results.errors.push({ productId: pid, step: "gtin", message: "Missing or invalid GTIN" });
          return;
        }

        // 0. Normalise — only ever previously ran as a side-effect of
        // auto-categorising uncategorised products, so anything already
        // categorised (the common case) stayed stuck on "pending" forever.
        if (!p.normalised_at) {
          try {
            await normaliseAndPersist({ supabase, productId: pid });
          } catch (e: any) {
            results.errors.push({
              productId: pid,
              step: "normalise",
              message: e?.message ?? "Normalisation failed",
            });
          }
        }

        // 1. QR + shell passport + image (generateForProduct handles all three)
        let qrClashed = false;
        try {
          await generateForProduct(supabase, userId, pid, data.force);
        } catch (e: any) {
          const msg = e?.message ?? "QR failed";
          // Detect the structured GTIN clash — image + enrichment cannot
          // succeed until the user merges the duplicate, so skip them
          // instead of cascading two more misleading "failed" errors.
          try {
            const parsed = JSON.parse(msg);
            if (parsed?.code === "GTIN_CLASH") qrClashed = true;
          } catch {
            /* not structured */
          }
          results.errors.push({ productId: pid, step: "qr", message: msg });
        }

        if (!qrClashed) {
          // 2. Image resolver (in case QR path skipped it)
          try {
            await resolveAndSyncProductImage({ supabase, productId: pid });
          } catch (e: any) {
            results.errors.push({
              productId: pid,
              step: "image",
              message: e?.message ?? "Image failed",
            });
          }

          // 3. Passport enrichment
          try {
            const r = await enrichProductPassport(supabaseAdmin, pid, { overwrite: false });
            if (!r.ok) {
              results.errors.push({ productId: pid, step: "enrichment", message: r.error });
            }
          } catch (e: any) {
            results.errors.push({
              productId: pid,
              step: "enrichment",
              message: e?.message ?? "Enrichment failed",
            });
          }
        }

        results.succeeded++;
      } catch (e: any) {
        results.failed++;
        results.errors.push({ productId: pid, step: "unknown", message: e?.message ?? "Failed" });
      }
    };

    // Parallel batches of 4
    const BATCH = 4;
    for (let i = 0; i < data.productIds.length; i += BATCH) {
      const chunk = data.productIds.slice(i, i + BATCH);
      await Promise.all(chunk.map(runOne));
    }
    return results;
  });

// Same as bulkCompleteDigitalIdentity's normalise+QR+image steps, without
// the passport-enrichment step — used by the setup wizard so "Converting to
// QR codes" and "Enhancing intelligence" can be shown as distinct phases
// with their own progress bar instead of one opaque combined step.
export const bulkGenerateQrAndImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ productIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { generateForProduct, isValidGtin } = await import("./qr.functions");
    const { resolveAndSyncProductImage } = await import("./product-images.server");
    const { normaliseAndPersist } = await import("./normalisation.functions");

    const results = {
      succeeded: 0,
      skipped: 0,
      errors: [] as Array<{ productId: string; step: string; message: string }>,
    };

    const runOne = async (pid: string) => {
      try {
        const { data: p } = await supabase
          .from("products")
          .select("id, gtin, normalised_at")
          .eq("id", pid)
          .maybeSingle();
        if (!p) {
          results.skipped++;
          return;
        }
        const gtin = String(p.gtin ?? "").trim();
        if (!gtin || !isValidGtin(gtin)) {
          results.skipped++;
          results.errors.push({ productId: pid, step: "gtin", message: "Missing or invalid GTIN" });
          return;
        }

        if (!p.normalised_at) {
          try {
            await normaliseAndPersist({ supabase, productId: pid });
          } catch (e: any) {
            results.errors.push({
              productId: pid,
              step: "normalise",
              message: e?.message ?? "Normalisation failed",
            });
          }
        }

        try {
          await generateForProduct(supabase, userId, pid, false);
        } catch (e: any) {
          results.errors.push({ productId: pid, step: "qr", message: e?.message ?? "QR failed" });
        }

        try {
          await resolveAndSyncProductImage({ supabase, productId: pid });
        } catch (e: any) {
          results.errors.push({ productId: pid, step: "image", message: e?.message ?? "Image failed" });
        }

        results.succeeded++;
      } catch (e: any) {
        results.errors.push({ productId: pid, step: "unknown", message: e?.message ?? "Failed" });
      }
    };

    const BATCH = 4;
    for (let i = 0; i < data.productIds.length; i += BATCH) {
      const chunk = data.productIds.slice(i, i + BATCH);
      await Promise.all(chunk.map(runOne));
    }
    return results;
  });

// Returns the caller's incomplete product IDs (missing QR, image, or enrichment).
export const listIncompleteDigitalIdentityIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { ids: [] as string[] };
    const { data: prods } = await supabase
      .from("products")
      .select("id, gtin, image_status, qr_status, normalised_at")
      .eq("retailer_id", retailerId)
      .eq("status", "active");
    const { data: passports } = await supabase
      .from("product_passports")
      .select("product_id, enrichment_status")
      .eq("retailer_id", retailerId);
    const enrichMap = new Map<string, string>();
    for (const p of passports ?? []) enrichMap.set(p.product_id, p.enrichment_status ?? "pending");
    const ids: string[] = [];
    for (const p of prods ?? []) {
      const gtin = String(p.gtin ?? "").trim();
      if (!gtin) continue; // can't complete without GTIN
      const needsNormalise = !p.normalised_at;
      const needsImg = !p.image_status || p.image_status === "pending";
      const needsQr = p.qr_status !== "active";
      const needsEnrich = (enrichMap.get(p.id) ?? "pending") !== "complete";
      if (needsNormalise || needsImg || needsQr || needsEnrich) ids.push(p.id);
    }
    return { ids };
  });
