import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- GS1 helpers ----------

export function isValidGtin(input: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(input)) return false;
  const padded = input.padStart(14, "0");
  const digits = padded.split("").map(Number);
  const check = digits[13];
  // Weight 3 applies to the digit immediately left of the check digit
  // (index 12) and alternates outward — i.e. weight 3 at even indices,
  // 1 at odd. This previously had the parity inverted, which rejected
  // the majority of genuinely valid GTINs (verified against a real
  // UPC-A) and blocked QR generation for almost everything.
  const sum = digits
    .slice(0, 13)
    .reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  const expected = (10 - (sum % 10)) % 10;
  return check === expected;
}

export function toGtin14(input: string): string {
  return input.padStart(14, "0");
}

// ---------- Public helpers ----------

export const getPublicScanBase = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequestHost, getRequestHeader } = await import(
      "@tanstack/react-start/server"
    );
    const envBase = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (envBase) return { base: envBase };
    try {
      const host = getRequestHost();
      const proto = getRequestHeader("x-forwarded-proto") ?? "https";
      if (host) return { base: `${proto}://${host}` };
    } catch {
      /* not in request context */
    }
    return { base: "" };
  },
);

function publicStorageUrl(path: string) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/storage/v1/object/public/qr-artifacts/${path}`;
}

// ---------- Read active QR ----------

export type ActiveQr = {
  id: string;
  product_id: string;
  gtin: string;
  status: string;
  version: number;
  generated_at: string;
  resolver_url: string;
  digital_link_url: string;
  png_url: string;
  svg_url: string;
};

async function readActiveQr(supabase: any, productId: string): Promise<ActiveQr | null> {
  const { data } = await supabase
    .from("product_qr_assets")
    .select(
      "id, product_id, gtin, status, version, generated_at, resolver_url, digital_link_url, png_path, svg_path",
    )
    .eq("product_id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    product_id: data.product_id,
    gtin: data.gtin,
    status: data.status,
    version: data.version,
    generated_at: data.generated_at,
    resolver_url: data.resolver_url,
    digital_link_url: data.digital_link_url,
    png_url: publicStorageUrl(data.png_path),
    svg_url: publicStorageUrl(data.svg_path),
  };
}

export const getProductQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    return { qr: await readActiveQr(context.supabase, data.productId) };
  });

// ---------- Generate / regenerate ----------

export async function generateForProduct(
  supabase: any,
  userId: string,
  productId: string,
  force: boolean,
  storeId?: string | null,
): Promise<ActiveQr> {

  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, retailer_id, name, sku, gtin, barcode_type")
    .eq("id", productId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!product) throw new Error("Product not found");

  // Validate barcode
  const rawGtin = String(product.gtin ?? "").trim();
  if (!rawGtin) {
    throw new Error("This product has no barcode. Add a valid GTIN/EAN/UPC before generating a QR code.");
  }
  if (!isValidGtin(rawGtin)) {
    throw new Error("The product barcode is invalid. Please correct the GTIN and try again.");
  }
  const gtin14 = toGtin14(rawGtin);

  // Existing active QR for this product?
  const existingOwn = await readActiveQr(supabase, productId);
  if (existingOwn && !force) return existingOwn;

  // GTIN uniqueness is scoped per retailer (partial unique index also
  // protects us) — the same manufacturer GTIN is legitimately stocked by
  // multiple retailers, so each gets their own resolver for it.
  const { data: gtinClash } = await supabase
    .from("product_qr_assets")
    .select("id, product_id")
    .eq("gtin", gtin14)
    .eq("retailer_id", product.retailer_id)
    .eq("status", "active")
    .maybeSingle();
  if (gtinClash && gtinClash.product_id !== productId) {
    // Structured error so the UI can offer a merge flow instead of just
    // showing a dead-end toast.
    const { data: other } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("id", gtinClash.product_id)
      .maybeSingle();
    throw new Error(
      JSON.stringify({
        code: "GTIN_CLASH",
        gtin: gtin14,
        otherProductId: gtinClash.product_id,
        otherProductName: other?.name ?? "another product",
        otherProductSku: other?.sku ?? null,
      }),
    );
  }

  // Retire existing active row if regenerating — checked, unlike before: an
  // unchecked failure here (e.g. an RLS policy silently rejecting the
  // update) left the old row "active" while the code below still tried to
  // insert a new active row for the same (gtin, retailer_id), surfacing as
  // a confusing "duplicate key" error from the insert instead of the real
  // cause.
  let nextVersion = 1;
  if (existingOwn) {
    nextVersion = existingOwn.version + 1;
    const { error: retireErr } = await supabase
      .from("product_qr_assets")
      .update({ status: "retired" })
      .eq("id", existingOwn.id);
    if (retireErr) {
      throw new Error(`Could not retire the previous QR code: ${retireErr.message}`);
    }
  }

  // Resolve store attribution — explicit storeId wins, else the retailer's
  // only store (silent), else null (retailer-wide QR for multi-store).
  let effectiveStoreId: string | null = storeId ?? null;
  let effectiveStoreName: string | null = null;
  if (!effectiveStoreId) {
    const { data: stores } = await supabase
      .from("stores")
      .select("id, name")
      .eq("retailer_id", product.retailer_id)
      .limit(2);
    if (stores && stores.length === 1) {
      effectiveStoreId = stores[0].id;
      effectiveStoreName = stores[0].name;
    }
  } else {
    const { data: st } = await supabase
      .from("stores")
      .select("name")
      .eq("id", effectiveStoreId)
      .eq("retailer_id", product.retailer_id)
      .maybeSingle();
    if (!st) throw new Error("Selected store does not belong to this retailer.");
    effectiveStoreName = (st as any).name;
  }

  // Build GS1 Digital Link — the canonical GS1 URL points to id.gs1.org,
  // but the printed QR encodes our own resolver URL so scans land on our
  // tracking route. Append ?s=<store_id> so the resolver can attribute the
  // scan to the branch that printed this specific card.
  const { resolverUrlForGtin } = await import("./passport.server");
  const baseResolver = resolverUrlForGtin(gtin14);
  const resolverUrl = effectiveStoreId
    ? `${baseResolver}?s=${effectiveStoreId}`
    : baseResolver;
  const canonicalGs1 = `https://id.gs1.org/01/${gtin14}`;

  // Render PNG + SVG
  const QRCode = (await import("qrcode")).default;
  const png = await QRCode.toBuffer(resolverUrl, {
    errorCorrectionLevel: "Q",
    margin: 4,
    width: 800,
    color: { dark: "#0A1F5C", light: "#ffffff" },
  });
  const svg = await QRCode.toString(resolverUrl, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 4,
    width: 800,
    color: { dark: "#0A1F5C", light: "#ffffff" },
  });

  // Upload artifacts (privileged; RLS on storage.objects varies by bucket policy)
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const storeSuffix = effectiveStoreId ? `-s${effectiveStoreId.slice(0, 8)}` : "";
  const base = `${product.retailer_id}/${productId}/${gtin14}-v${nextVersion}${storeSuffix}`;
  const pngPath = `${base}.png`;
  const svgPath = `${base}.svg`;
  const up1 = await supabaseAdmin.storage
    .from("qr-artifacts")
    .upload(pngPath, png, { contentType: "image/png", upsert: true });
  if (up1.error) throw new Error(up1.error.message);
  const up2 = await supabaseAdmin.storage
    .from("qr-artifacts")
    .upload(svgPath, new Blob([svg], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml",
      upsert: true,
    });
  if (up2.error) throw new Error(up2.error.message);

  // Persist the asset row
  const { data: inserted, error: insErr } = await supabase
    .from("product_qr_assets")
    .insert({
      retailer_id: product.retailer_id,
      product_id: productId,
      gtin: gtin14,
      store_id: effectiveStoreId,
      store_name: effectiveStoreName,
      digital_link_url: canonicalGs1,
      resolver_url: resolverUrl,
      png_path: pngPath,
      svg_path: svgPath,
      status: "active",
      version: nextVersion,
      generated_at: new Date().toISOString(),
      generated_by: userId,
      created_by: userId,
    })
    .select("id, product_id, gtin, status, version, generated_at, resolver_url, digital_link_url, png_path, svg_path")
    .single();
  if (insErr) throw new Error(insErr.message);


  // Mirror status on the product record
  await supabase
    .from("products")
    .update({ qr_status: "active", digital_link_url: canonicalGs1 })
    .eq("id", productId);

  // Ensure a published shell passport exists so the QR always resolves.
  const dppId = crypto.randomUUID();
  const { data: existingPassport } = await supabaseAdmin
    .from("product_passports")
    .select("dpp_id")
    .eq("product_id", productId)
    .maybeSingle();
  const effectiveDppId = existingPassport?.dpp_id ?? dppId;

  await supabaseAdmin
    .from("product_passports")
    .upsert(
      {
        product_id: productId,
        retailer_id: product.retailer_id,
        dpp_id: effectiveDppId,
        gtin: gtin14,
        status: "published",
        visibility: "public",
        enrichment_status: existingPassport ? undefined : "pending",
      },
      { onConflict: "product_id" },
    );

  await supabase
    .from("products")
    .update({ digital_product_passport_id: effectiveDppId })
    .eq("id", productId);

  // Resolve the product image (best-effort — never blocks QR generation)
  try {
    const { resolveAndSyncProductImage } = await import("./product-images.server");
    await resolveAndSyncProductImage({ supabase, productId });
  } catch {
    /* image resolver is best-effort */
  }

  // Enqueue passport enrichment (idempotent upsert)
  try {
    await supabaseAdmin.from("passport_enrichment_queue").upsert({
      product_id: productId,
      retailer_id: product.retailer_id,
    });
  } catch {
    /* enrichment queue best-effort */
  }

  return {
    id: inserted.id,
    product_id: inserted.product_id,
    gtin: inserted.gtin,
    status: inserted.status,
    version: inserted.version,
    generated_at: inserted.generated_at,
    resolver_url: inserted.resolver_url,
    digital_link_url: inserted.digital_link_url,
    png_url: publicStorageUrl(inserted.png_path),
    svg_url: publicStorageUrl(inserted.svg_path),
  };
}

export const generateProductQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        force: z.boolean().optional().default(false),
        storeId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    return await generateForProduct(
      context.supabase,
      context.userId,
      data.productId,
      data.force,
      data.storeId ?? null,
    );
  });


// Back-compat: existing callers (bulk dialog, imports, product row menu) keep
// working. Template is accepted but ignored — GS1 Digital Link is canonical.
export const regenerateProductQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        template: z.string().optional(),
        force: z.boolean().optional().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    return await generateForProduct(context.supabase, context.userId, data.productId, data.force);
  });

export const bulkGenerateQrs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productIds: z.array(z.string().uuid()).min(1).max(500),
        regenerate: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let created = 0;
    const errors: string[] = [];
    for (const pid of data.productIds) {
      try {
        await generateForProduct(context.supabase, context.userId, pid, data.regenerate);
        created++;
      } catch (e: any) {
        errors.push(`${pid}: ${e.message ?? "failed"}`);
      }
    }
    return { createdCount: created, errors };
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
        "id, scanned_at, device_type, user_agent, referrer, qr_version, store:stores(id,name)",
        { count: "exact" },
      )
      .eq("product_id", data.productId)
      .order("scanned_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });
