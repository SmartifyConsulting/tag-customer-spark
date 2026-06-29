import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TEMPLATES = ["classic", "minimal", "bold", "compact"] as const;
export type QrTemplate = (typeof TEMPLATES)[number];

function makeShortCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) s += chars[bytes[i] % chars.length];
  return s;
}

export const getProductQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tag } = await context.supabase
      .from("qr_tags")
      .select("id, short_code, template, version, is_active, created_at, scan_count, last_scanned_at")
      .eq("product_id", data.productId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { tag };
  });

async function createTagFor(supabase: any, userId: string, productId: string, template: QrTemplate) {
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("retailer_id, store_id")
    .eq("id", productId)
    .maybeSingle();
  if (pErr || !product) throw new Error("Product not found");

  const { data: existing } = await supabase
    .from("qr_tags")
    .select("id, version")
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("qr_tags")
      .update({ is_active: false, status: "retired" })
      .eq("product_id", productId);
  }

  const nextVersion = (existing?.version ?? 0) + 1;
  let shortCode = makeShortCode();
  // collision check (extremely unlikely)
  for (let i = 0; i < 3; i++) {
    const { data: clash } = await supabase
      .from("qr_tags")
      .select("id")
      .eq("short_code", shortCode)
      .maybeSingle();
    if (!clash) break;
    shortCode = makeShortCode();
  }

  const { data: row, error } = await supabase
    .from("qr_tags")
    .insert({
      retailer_id: product.retailer_id,
      store_id: product.store_id,
      product_id: productId,
      code: shortCode,
      short_code: shortCode,
      template,
      version: nextVersion,
      is_active: true,
      status: "active",
      created_by: userId,
      regenerated_from: existing?.id ?? null,
    })
    .select("id, short_code, template, version")
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export const regenerateProductQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        template: z.enum(TEMPLATES).optional().default("classic"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    return await createTagFor(context.supabase, context.userId, data.productId, data.template);
  });

export const bulkGenerateQrs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productIds: z.array(z.string().uuid()).min(1).max(500),
        template: z.enum(TEMPLATES).optional().default("classic"),
        regenerate: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const created: string[] = [];
    for (const pid of data.productIds) {
      if (!data.regenerate) {
        const { data: existing } = await context.supabase
          .from("qr_tags")
          .select("id")
          .eq("product_id", pid)
          .eq("is_active", true)
          .maybeSingle();
        if (existing) continue;
      }
      const tag = await createTagFor(context.supabase, context.userId, pid, data.template);
      created.push(tag.id);
    }
    return { createdCount: created.length };
  });

export const listProductScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(100).default(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await context.supabase
      .from("qr_scans")
      .select(
        "id, scanned_at, device_type, user_agent, referrer, qr_version, store:stores(id,name), qr_tag:qr_tags(id, short_code)",
        { count: "exact" },
      )
      .eq("product_id", data.productId)
      .order("scanned_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });
