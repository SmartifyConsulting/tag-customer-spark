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
      supabase
        .from("stores")
        .select("id, name")
        .eq("retailer_id", retailerId)
        .order("name"),
    ]);
    return { categories: cats ?? [], stores: stores ?? [], retailerId };
  });

export const lookupBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().trim().min(3).max(64) }).parse(d),
  )
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
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
          data.code,
        )}.json`,
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
        "id, name, sku, brand, status, price_cents, sale_price_cents, currency, stock_qty, low_stock_threshold, images, image_url, promotion_start_date, promotion_end_date, color, size, updated_at, intent_score, intent_score_trend, intent_score_confidence, category:product_categories(id,name), store:stores(id,name)",
        { count: "exact" },
      );

    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,brand.ilike.%${s}%`);
    }
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.category_id) q = q.eq("category_id", data.category_id);
    if (data.store_id) q = q.eq("store_id", data.store_id);
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
      filtered = filtered.filter(
        (p: any) => p.stock_qty <= (p.low_stock_threshold ?? 0),
      );
    }

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
        "*, category:product_categories(id,name), store:stores(id,name), retailer:retailers(id,name,logo_url)",
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
      { count: scans30 },
      { count: scansTotal },
      { count: interestedCount },
      { count: notifSent },
      { data: recoveries },
      { data: trend },
    ] = await Promise.all([
      supabase
        .from("product_qr_assets")
        .select("id, product_id, gtin, status, version, generated_at, resolver_url, digital_link_url, png_path, svg_path")
        .eq("product_id", data.id)
        .eq("status", "active")
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
    const { data: row, error } = await supabase
      .from("products")
      .insert({
        ...data,
        retailer_id: retailerId,
        created_by: userId,
        image_url: data.images[0]?.url ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
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
    if (data.patch.images && data.patch.images.length)
      patch.image_url = data.patch.images[0].url;
    const { error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
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
    if (!(await canManage(supabase, userId, retailerId)))
      throw new Error("Not permitted");

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
    const { error } = await context.supabase
      .from("products")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
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
        return (
          (p.stock_qty ?? 0) > 0 &&
          (p.stock_qty ?? 0) <= (p.low_stock_threshold ?? 0)
        );
      return true;
    });
    return list;
  });
