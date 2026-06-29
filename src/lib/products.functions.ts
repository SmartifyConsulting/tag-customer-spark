import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { productInputSchema, listProductsSchema } from "./products.schemas";

type SB = Awaited<ReturnType<typeof requireSupabaseAuth.server>> extends never
  ? never
  : any;

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

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listProductsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("products")
      .select(
        "id, name, sku, brand, status, price_cents, sale_price_cents, currency, stock_qty, low_stock_threshold, images, image_url, promotion_start_date, promotion_end_date, color, size, updated_at, category:product_categories(id,name), store:stores(id,name)",
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
        .from("qr_tags")
        .select("id, short_code, template, version, is_active, created_at")
        .eq("product_id", data.id)
        .eq("is_active", true)
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

    return {
      product,
      qr,
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
