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
  // Nullable rather than defaulted here — commitProductImport needs to tell
  // "file has no price/stock column" apart from "file says 0", so a merge
  // import doesn't zero out an existing product's price just because this
  // particular file didn't carry one. Null is coalesced to 0 at insert time
  // and (for overwrite mode) at update time too.
  price_cents: z.number().int().min(0).nullable().optional(),
  sale_price_cents: z.number().int().min(0).optional().nullable(),
  stock_qty: z.number().int().min(0).nullable().optional(),
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

// Excel commonly stores a long numeric barcode as a float and can surface
// a spurious trailing fraction (e.g. a cell formatted with 2 decimals
// reads back as "6001234567895.00"). Strip any decimal portion before
// stripping non-digits, so it doesn't get concatenated into the digit
// string as extra digits — a barcode never legitimately has one.
function stripSpuriousDecimal(input: string): string {
  const dot = input.indexOf(".");
  return dot === -1 ? input : input.slice(0, dot);
}

function detectBarcodeType(code: unknown): string | null {
  if (code === null || code === undefined) return null;
  const s = stripSpuriousDecimal(String(code)).replace(/\D/g, "");
  if (s.length === 8) return "EAN-8";
  if (s.length === 12) return "UPC-A";
  if (s.length === 13) return "EAN-13";
  if (s.length === 14) return "GTIN-14";
  return null;
}

// Recomputes and replaces the trailing GS1 check digit — sources like
// spreadsheet typos, OCR, or an AI-generated demo catalogue routinely
// produce numbers that *look* like a barcode but fail the checksum, which
// silently blocked QR generation and the public passport page downstream
// with no visible error at import time. Only the last digit is replaced;
// the identifying digits (and correct barcodes) are untouched.
function withCorrectGs1CheckDigit(padded14: string): string {
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(padded14[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return padded14.slice(0, 13) + String(check);
}

function toGtin14(code: unknown): string | null {
  if (code === null || code === undefined) return null;
  const s = stripSpuriousDecimal(String(code)).replace(/\D/g, "");
  if (s.length !== 8 && s.length !== 12 && s.length !== 13 && s.length !== 14) return null;
  return withCorrectGs1CheckDigit(s.padStart(14, "0"));
}

function priceToCents(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

// Deterministic column → canonical-field mapping. Runs BEFORE (and as a
// safety net around) the AI mapping so a normal spreadsheet with sensible
// headers always imports, even if the AI call fails, times out, or guesses
// wrong. Header synonyms are matched case/punctuation-insensitively; a
// "Barcode (EAN-13)" header normalises to "barcode", "City/Province" to
// "city province", etc. Fields are resolved in priority order so a source
// column is never claimed by two canonical fields.
const HEADER_SYNONYMS: Record<string, string[]> = {
  // name is resolved before description so a dedicated "Name" column wins,
  // but a sheet whose only descriptive column is "Description" still maps
  // that to name (products require a name).
  name: ["name", "product name", "item name", "product title", "title", "product", "item", "description", "product description", "item description"],
  sku: ["sku", "product id", "productid", "item id", "item code", "product code", "stock code", "article", "article number", "article no", "style", "style code", "code", "ref", "reference"],
  gtin: ["barcode", "bar code", "ean", "ean13", "upc", "gtin", "global trade item number"],
  brand: ["brand", "manufacturer", "make", "vendor", "supplier"],
  category_name: ["category", "department", "product category", "category name", "group", "product group", "class", "subcategory", "sub category", "product type", "type"],
  color: ["color", "colour"],
  size: ["size"],
  price: ["price", "unit price", "retail price", "selling price", "sell price", "rrp", "list price", "amount"],
  sale_price: ["sale price", "promo price", "promotional price", "discount price", "special price", "special"],
  stock: ["stock", "qty", "quantity", "stock qty", "on hand", "onhand", "soh", "stock on hand", "available", "available qty"],
  currency: ["currency", "curr", "ccy"],
  store_name: ["branch name", "branch", "store name", "store", "site", "site name", "plant", "location", "warehouse", "outlet"],
  store_city: ["city", "town", "city province", "city/province"],
  store_province: ["province", "state", "region", "county"],
  store_country: ["country"],
};

// Priority order matters: name before description-y collisions, sku before
// gtin, store_name before store_city, etc.
const CANONICAL_ORDER = [
  "name", "sku", "gtin", "brand", "category_name", "store_name",
  "store_city", "store_province", "store_country", "price", "sale_price",
  "stock", "currency", "color", "size",
];

function normaliseHeader(h: string): string {
  return String(h)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parenthetical notes: "Barcode (EAN-13)" -> "barcode"
    .replace(/[/_\-.]+/g, " ") // slashes/underscores/dashes -> space
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deterministicHeaderMap(headers: string[]): Record<string, string | null> {
  const normed = headers.map((h) => ({ raw: h, norm: normaliseHeader(h) }));
  const used = new Set<string>();
  const map: Record<string, string | null> = {};

  for (const field of CANONICAL_ORDER) {
    const synonyms = HEADER_SYNONYMS[field] ?? [];
    let match: string | null = null;
    // Exact normalised match first, then whole-word containment.
    for (const syn of synonyms) {
      const hit = normed.find((h) => !used.has(h.raw) && h.norm === syn);
      if (hit) {
        match = hit.raw;
        break;
      }
    }
    if (!match) {
      for (const syn of synonyms) {
        const hit = normed.find(
          (h) => !used.has(h.raw) && new RegExp(`\\b${syn.replace(/\s+/g, "\\s+")}\\b`).test(h.norm),
        );
        if (hit) {
          match = hit.raw;
          break;
        }
      }
    }
    if (match) used.add(match);
    map[field] = match;
  }
  return map;
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
      // Deterministic header mapping first — reliable for any spreadsheet
      // with sensible column names, and independent of the AI service.
      const detMap = deterministicHeaderMap(headers);

      // Only fall back to AI when the deterministic pass can't find the two
      // required fields (name + sku). Even then, deterministic matches win;
      // the AI just fills gaps. Wrapped so an AI failure can never break an
      // import the deterministic map already handled.
      let map: Record<string, string | null> = detMap;
      if (!detMap.name || !detMap.sku) {
        try {
          const sample = rawRows.slice(0, 5);
          const mapping = await callAiJson(
            `Column headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sample)}\n\nReturn JSON: {"map": { canonicalField: sourceHeader }} mapping any of {name, sku, gtin, brand, description, category_name, color, size, price, sale_price, stock, currency, store_name, store_city, store_province, store_country} to the best-matching source header (or null if absent). store_name covers ERP branch/site/plant/location/warehouse columns (e.g. SAP plant code, Oracle inventory org, Dynamics warehouse, a POS store master column) — map it whenever the sheet has a column identifying which physical store/branch a row belongs to. store_province covers state/province/region columns.`,
            "You map raw spreadsheet columns to a canonical product schema. Output only valid JSON.",
          );
          const aiMap: Record<string, string | null> = mapping?.map ?? {};
          // Merge: AI fills the base, deterministic overrides where it found
          // a match (deterministic is the trusted source of truth).
          map = { ...aiMap };
          for (const [field, source] of Object.entries(detMap)) {
            if (source) map[field] = source;
          }
        } catch {
          // AI unavailable — proceed with whatever the deterministic map has.
          map = detMap;
        }
      }
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
    price_cents: r.price != null || r.price_cents != null ? priceToCents(r.price ?? r.price_cents) : null,
    sale_price_cents: r.sale_price != null ? priceToCents(r.sale_price) : null,
    stock_qty: r.stock != null || r.stock_qty != null ? Number(r.stock ?? r.stock_qty) || 0 : null,
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
  .inputValidator((d: unknown) =>
    z
      .object({
        rows: z.array(rowSchema).min(1).max(500),
        // merge: only fields the file actually provided are written, so a
        // partial re-export (e.g. a stock-only refresh) can't blank out
        // fields it doesn't carry. overwrite: this file is treated as the
        // authoritative full record — blanks replace existing values.
        mode: z.enum(["merge", "overwrite"]).default("merge"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { mode } = data;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");

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
    const { data: staffStore } = await supabase
      .from("staff")
      .select("store_id")
      .eq("retailer_id", retailerId)
      .eq("user_id", userId)
      .eq("status", "active")
      .not("store_id", "is", null)
      .limit(1)
      .maybeSingle();
    const soleStoreId = (storeRows ?? []).length === 1 ? (storeRows as any[])[0].id : null;
    const defaultUploadStoreId = staffStore?.store_id ?? soleStoreId ?? null;
    let storesCreated = 0;

    // Rows with no store/branch column (single-shop merchants) must still
    // land on a concrete store — leaving store_id null would let the same
    // barcode+description slip past the products_retailer_gtin_description_store_key
    // constraint (Postgres never treats NULL = NULL as a match), so every
    // "no store info" row across the whole import shares one placeholder
    // store instead. Same name as ensureRetailerHasStore's post-import
    // fallback, so the two don't create two different placeholders.
    let defaultStoreId: string | null = null;
    async function getDefaultStoreId(): Promise<string> {
      if (defaultStoreId) return defaultStoreId;
      const existing = storeByName.get("sole proprietor");
      if (existing) {
        defaultStoreId = existing.id;
        return defaultStoreId;
      }
      const { data: newStore, error } = await supabase
        .from("stores")
        .insert({ retailer_id: retailerId, name: "Sole proprietor", status: "active" } as any)
        .select("id")
        .single();
      if (error) throw new Error(`Failed creating default store: ${error.message}`);
      defaultStoreId = newStore.id;
      storeByName.set("sole proprietor", { id: newStore.id, city: null, province: null, country: null });
      storesCreated++;
      return defaultStoreId;
    }

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

        let storeId: string | null = defaultUploadStoreId;
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
        if (!storeId) storeId = await getDefaultStoreId();

        const canonicalGs1 = row.gtin ? `https://id.gs1.org/01/${row.gtin}` : null;
        // Never null — description sits in the composite uniqueness
        // constraint alongside gtin/store, and Postgres never treats
        // NULL = NULL as a match, so a blank description would silently
        // exempt a row from duplicate detection.
        const description = row.description || row.name;

        // Match by (retailer, sku) first — the stable identifier most
        // re-imports carry. Fall back to the natural key (gtin +
        // description + store) for a file that assigned a new SKU to a
        // product already on file, so it updates in place instead of
        // tripping the unique constraint as a fresh insert.
        let existing: { id: string } | null = null;
        const { data: bySku } = await supabase
          .from("products")
          .select("id")
          .eq("retailer_id", retailerId)
          .eq("sku", row.sku)
          .maybeSingle();
        existing = bySku ?? null;
        if (!existing && row.gtin) {
          const { data: byNaturalKey } = await supabase
            .from("products")
            .select("id")
            .eq("retailer_id", retailerId)
            .eq("gtin", row.gtin)
            .eq("description", description)
            .eq("store_id", storeId)
            .maybeSingle();
          existing = byNaturalKey ?? null;
        }

        const payload: any = {
          retailer_id: retailerId,
          created_by: userId,
          name: row.name,
          sku: row.sku,
          brand: row.brand,
          description,
          category_id: categoryId,
          store_id: storeId,
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
        try {
          if (existing) {
            const updatePayload =
              mode === "overwrite"
                ? { ...payload, price_cents: payload.price_cents ?? 0, stock_qty: payload.stock_qty ?? 0 }
                : Object.fromEntries(
                    Object.entries(payload).filter(([, v]) => v !== null && v !== undefined),
                  );
            const { error } = await supabase.from("products").update(updatePayload).eq("id", existing.id);
            if (error) throw new Error(error.message);
            productId = existing.id;
            updated++;
          } else {
            const { data: inserted, error } = await supabase
              .from("products")
              .insert({ ...payload, price_cents: payload.price_cents ?? 0, stock_qty: payload.stock_qty ?? 0 })
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            productId = inserted.id;
            created++;
          }
        } catch (e: any) {
          if (e?.message?.includes("products_retailer_gtin_description_store_key")) {
            throw new Error(
              `${row.sku}: a product with this barcode already exists in this store — skipped.`,
            );
          }
          throw e;
        }

        // Image resolution and QR generation deliberately do NOT happen here
        // — each is a real network/AI-bound cost per product (Open Food
        // Facts + Serper lookups, QR render, storage uploads), and running
        // them inline for every row made this request take minutes for a
        // full import, appearing to hang since the progress bar only moves
        // once per chunk. Callers run them as a separate phase afterwards
        // (see bulkGenerateQrAndImages) so progress stays visible.
        if (!row.gtin) {
          errors.push(`${row.sku}: Invalid Barcode — no QR will be generated.`);
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
      // fetchLogos: false — logo fetching is slow (Clearbit + AI fallback
      // per brand) and a fresh import can introduce a dozen-plus distinct
      // brands at once; doing that synchronously here previously made the
      // whole import request (and the setup wizard's progress bar) hang for
      // minutes. Brand admin's opportunistic backfill picks up logos after.
      const brandRes = await linkProductsToBrandsForRetailer(supabase, retailerId, {
        fetchLogos: false,
      });
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
      taxonomyLevels: taxonomy.levels ?? null,
      storesCreated,
      brandsCreated,
      brandLogosFetched,
    };
  });
