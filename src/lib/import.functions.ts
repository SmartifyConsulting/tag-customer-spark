import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  gtin: z.string().optional().nullable(),
  barcode_type: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category_name: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  price_cents: z.number().int().min(0).default(0),
  sale_price_cents: z.number().int().min(0).optional().nullable(),
  stock_qty: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("ZAR"),
  // ERPs typically expose this as a plant/site/branch/location code (SAP
  // WERKS, Oracle inventory org, Dynamics warehouse, POS store master row).
  // Optional because most single-branch retailers' exports won't have it.
  store_name: z.string().optional().nullable(),
  store_city: z.string().optional().nullable(),
  store_province: z.string().optional().nullable(),
  store_country: z.string().optional().nullable(),
});
export type ImportRow = z.infer<typeof rowSchema>;

async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id as string | null;
}

function detectBarcodeType(code: unknown): string | null {
  if (code === null || code === undefined) return null;
  const s = String(code).replace(/\D/g, "");
  if (s.length === 8) return "EAN-8";
  if (s.length === 12) return "UPC-A";
  if (s.length === 13) return "EAN-13";
  if (s.length === 14) return "GTIN-14";
  return null;
}

function toGtin14(code: unknown): string | null {
  if (code === null || code === undefined) return null;
  const s = String(code).replace(/\D/g, "");
  if (s.length !== 8 && s.length !== 12 && s.length !== 13 && s.length !== 14) return null;
  return s.padStart(14, "0");
}

function priceToCents(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function callAiJson(
  prompt: string,
  systemPrompt: string,
  filePart?: { mime: string; base64: string; filename: string },
) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const content: any[] = [{ type: "text", text: prompt }];
  if (filePart) {
    content.push({
      type: "file",
      file: {
        filename: filePart.filename,
        file_data: `data:${filePart.mime};base64,${filePart.base64}`,
      },
    });
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export const previewProductImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filename: z.string().min(1),
        mime: z.string().min(1),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const isPdf = data.mime.includes("pdf") || data.filename.toLowerCase().endsWith(".pdf");
    let rawRows: Record<string, any>[] = [];
    let headers: string[] = [];

    if (!isPdf) {
      const XLSX = await import("xlsx");
      const buf = Buffer.from(data.base64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
      headers = rawRows.length ? Object.keys(rawRows[0]) : [];
    }

    // Ask AI to map to canonical fields
    let mapped: ImportRow[] = [];
    if (isPdf) {
      const result = await callAiJson(
        'Extract every product from the attached PDF. Return JSON like {"rows":[{...}]} where each row has: name, sku, gtin (barcode digits only), brand, description, category_name, color, size, price (as number, ZAR), sale_price (optional), stock (integer), store_name (branch/site/plant/location this row belongs to, if the document shows one — otherwise null), store_city, store_province (state/province/region), store_country. If SKU is missing, use the GTIN as SKU. Preserve barcode identifiers exactly.',
        "You are a product-catalogue extraction assistant. Output only valid JSON.",
        { mime: data.mime, base64: data.base64, filename: data.filename },
      );
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      mapped = rows
        .map((r: any) => normaliseRow(r))
        .filter((r: ImportRow | null): r is ImportRow => r !== null);
    } else {
      // Ask AI to produce a header mapping
      const sample = rawRows.slice(0, 5);
      const mapping = await callAiJson(
        `Column headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sample)}\n\nReturn JSON: {"map": { canonicalField: sourceHeader }} mapping any of {name, sku, gtin, brand, description, category_name, color, size, price, sale_price, stock, currency, store_name, store_city, store_province, store_country} to the best-matching source header (or null if absent). store_name covers ERP branch/site/plant/location/warehouse columns (e.g. SAP plant code, Oracle inventory org, Dynamics warehouse, a POS store master column) — map it whenever the sheet has a column identifying which physical store/branch a row belongs to. store_province covers state/province/region columns.`,
        "You map raw spreadsheet columns to a canonical product schema. Output only valid JSON.",
      );
      const map: Record<string, string | null> = mapping?.map ?? {};
      mapped = rawRows
        .map((row) => {
          const get = (k: string) => (map[k] ? row[map[k] as string] : undefined);
          return normaliseRow({
            name: get("name"),
            sku: get("sku"),
            gtin: get("gtin"),
            brand: get("brand"),
            description: get("description"),
            category_name: get("category_name"),
            color: get("color"),
            size: get("size"),
            price: get("price"),
            sale_price: get("sale_price"),
            stock: get("stock"),
            currency: get("currency"),
            store_name: get("store_name"),
            store_city: get("store_city"),
            store_province: get("store_province"),
            store_country: get("store_country"),
          });
        })
        .filter((r: ImportRow | null): r is ImportRow => r !== null);
    }

    return { rows: mapped, count: mapped.length, headers };
  });

function normaliseRow(r: any): ImportRow | null {
  const gtinRaw = r.gtin ?? r.barcode ?? r.ean ?? null;
  const gtin = toGtin14(gtinRaw);
  const skuRaw = (r.sku ?? "").toString().trim();
  const sku = skuRaw || (gtin ?? "");
  const name = (r.name ?? "").toString().trim();
  if (!name || !sku) return null;
  const parsed = rowSchema.safeParse({
    name,
    sku,
    gtin,
    barcode_type: detectBarcodeType(gtinRaw),
    brand: r.brand ? String(r.brand) : null,
    description: r.description ? String(r.description) : null,
    category_name: r.category_name ? String(r.category_name) : null,
    color: r.color ? String(r.color) : null,
    size: r.size ? String(r.size) : null,
    price_cents: priceToCents(r.price ?? r.price_cents ?? 0),
    sale_price_cents: r.sale_price != null ? priceToCents(r.sale_price) : null,
    stock_qty: Number(r.stock ?? r.stock_qty ?? 0) || 0,
    currency: (r.currency ? String(r.currency) : "ZAR").toUpperCase().slice(0, 3),
    store_name: r.store_name ? String(r.store_name).trim() || null : null,
    store_city: r.store_city ? String(r.store_city).trim() || null : null,
    store_province: r.store_province ? String(r.store_province).trim() || null : null,
    store_country: r.store_country ? String(r.store_country).trim() || null : null,
  });
  return parsed.success ? parsed.data : null;
}

export const commitProductImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(rowSchema).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");

    const { generateForProduct } = await import("./qr.functions");
    const { resolveAndSyncProductImage } = await import("./product-images.server");

    // Preload categories
    const { data: cats } = await supabase
      .from("product_categories")
      .select("id, name")
      .eq("retailer_id", retailerId);
    const catByName = new Map<string, string>();
    (cats ?? []).forEach((c: any) => catByName.set(c.name.toLowerCase(), c.id));

    // Preload stores — same auto-create-on-first-sight pattern as
    // categories, keyed by name since that's the one field every ERP
    // branch export reliably has. Newly-created stores get city/country
    // from the row when present; existing stores are never overwritten.
    const { data: storeRows } = await supabase
      .from("stores")
      .select("id, name, city, province, country")
      .eq("retailer_id", retailerId);
    const storeByName = new Map<
      string,
      { id: string; city: string | null; province: string | null; country: string | null }
    >();
    (storeRows ?? []).forEach((s: any) =>
      storeByName.set(s.name.toLowerCase(), {
        id: s.id,
        city: s.city,
        province: s.province,
        country: s.country,
      }),
    );
    let storesCreated = 0;

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    const { suggestCategoryForProduct } = await import("./categories.functions");
    const { data: catRows } = await supabase
      .from("product_categories")
      .select("id, name, parent_id")
      .eq("retailer_id", retailerId);
    const catList = (catRows ?? []) as { id: string; name: string; parent_id: string | null }[];

    for (const row of data.rows) {
      try {
        let categoryId: string | null = null;
        let categoryConfidence: number | null = null;
        if (row.category_name) {
          const key = row.category_name.toLowerCase();
          if (catByName.has(key)) categoryId = catByName.get(key)!;
          else {
            const { data: newCat } = await supabase
              .from("product_categories")
              .insert({ retailer_id: retailerId, name: row.category_name })
              .select("id")
              .single();
            if (newCat) {
              categoryId = newCat.id;
              catByName.set(key, newCat.id);
              catList.push({ id: newCat.id, name: row.category_name, parent_id: null });
            }
          }
        }
        if (!categoryId) {
          // Auto-categorise via AI + fallback
          const res = await suggestCategoryForProduct({
            supabase,
            retailerId,
            userId,
            product: {
              name: row.name,
              brand: row.brand,
              description: row.description,
              gtin: row.gtin,
            },
            categories: catList,
          });
          if (res.category_id) {
            categoryId = res.category_id;
            categoryConfidence = res.confidence;
            if (res.created) {
              // Refresh local cache so next rows can reuse it
              const { data: fresh } = await supabase
                .from("product_categories")
                .select("id, name, parent_id")
                .eq("id", res.category_id)
                .maybeSingle();
              if (fresh) {
                catList.push(fresh as any);
                catByName.set(fresh.name.toLowerCase(), fresh.id);
              }
            }
          }
        }

        let storeId: string | null = null;
        if (row.store_name) {
          const key = row.store_name.toLowerCase();
          const found = storeByName.get(key);
          if (found) {
            storeId = found.id;
          } else {
            const { data: newStore } = await supabase
              .from("stores")
              .insert({
                retailer_id: retailerId,
                name: row.store_name,
                city: row.store_city,
                province: row.store_province,
                country: row.store_country,
                status: "active",
              } as any)
              .select("id")
              .single();
            if (newStore) {
              storeId = newStore.id;
              storeByName.set(key, {
                id: newStore.id,
                city: row.store_city ?? null,
                province: row.store_province ?? null,
                country: row.store_country ?? null,
              });
              storesCreated++;
            }
          }
        }

        const canonicalGs1 = row.gtin ? `https://id.gs1.org/01/${row.gtin}` : null;

        // Upsert product by (retailer, sku)
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("retailer_id", retailerId)
          .eq("sku", row.sku)
          .maybeSingle();

        const payload: any = {
          retailer_id: retailerId,
          created_by: userId,
          name: row.name,
          sku: row.sku,
          brand: row.brand,
          description: row.description,
          category_id: categoryId,
          ...(storeId ? { store_id: storeId } : {}),
          suggested_category_id: categoryId,
          category_confidence: categoryConfidence,
          color: row.color,
          size: row.size,
          price_cents: row.price_cents,
          sale_price_cents: row.sale_price_cents ?? null,
          currency: row.currency,
          stock_qty: row.stock_qty,
          gtin: row.gtin,
          barcode_type: row.barcode_type,
          digital_link_url: canonicalGs1,
          status: "active",
        };

        let productId: string;
        if (existing) {
          const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
          if (error) throw new Error(error.message);
          productId = existing.id;
          updated++;
        } else {
          const { data: inserted, error } = await supabase
            .from("products")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          productId = inserted.id;
          created++;
        }

        // Resolve product image first so the shell passport can seed hero_image.
        try {
          await resolveAndSyncProductImage({ supabase, productId });
        } catch (imgErr: any) {
          errors.push(`${row.sku}: image resolve failed — ${imgErr?.message ?? "unknown"}`);
        }

        // Generate GS1 QR — this also seeds a published shell passport and
        // enqueues enrichment. Skip cleanly when the barcode is missing or
        // invalid; the product row is still saved so the retailer can fix it.
        if (row.gtin) {
          try {
            await generateForProduct(supabase, userId, productId, false);
          } catch (qrErr: any) {
            errors.push(`${row.sku}: ${qrErr?.message ?? "QR generation failed"}`);
          }
        } else {
          errors.push(`${row.sku}: Invalid Barcode — no QR generated.`);
        }
      } catch (e: any) {
        failed++;
        errors.push(`${row.sku}: ${e.message ?? "unknown error"}`);
      }
    }

    const { autoDetectTaxonomyProfile } = await import("./taxonomy.functions");
    const taxonomy = await autoDetectTaxonomyProfile({
      supabase,
      retailerId,
      userId,
      rows: data.rows,
    });

    // Brands previously only got created/linked when someone manually
    // clicked "Auto-link & fetch logos" in Brand admin, so a fresh import
    // showed "0 brands" no matter how many products carried a brand name.
    let brandsCreated = 0;
    let brandLogosFetched = 0;
    try {
      const { linkProductsToBrandsForRetailer } = await import("./brands.functions");
      const brandRes = await linkProductsToBrandsForRetailer(supabase, retailerId);
      brandsCreated = brandRes.created;
      brandLogosFetched = brandRes.logos;
    } catch {
      // Non-fatal — the manual "Auto-link & fetch logos" button still works.
    }

    return {
      created,
      updated,
      failed,
      errors,
      taxonomyProfileApplied: taxonomy.applied,
      taxonomyProfileName: taxonomy.templateName ?? null,
      storesCreated,
      brandsCreated,
      brandLogosFetched,
    };
  });
