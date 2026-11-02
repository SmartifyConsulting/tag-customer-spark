// Shared catalogue: reuse what TAG already knows about a barcode instead of
// paying for the same photo search / AI enrichment again.
//
// - Photos: only web-sourced ones (Open Food Facts, checked web photos) are
//   shared. A retailer's own uploads are never reused by anyone else.
// - Passports: only completed AI enrichments (never a retailer's manual edits),
//   and only generic product facts - no prices, stock, store or retailer data.
// - "Nothing found" is remembered for 30 days so a barcode with no usable web
//   photo isn't searched again on every page load.
// Explicit refresh buttons bypass all of this (see `force` / `overwrite`).

import { validGtin14 } from "./gtin-lookup.server";
import { logServiceCall } from "./ai-usage.server";

/**
 * Every way the SAME barcode might be stored: the number with leading zeros
 * added or removed (8, 12, 13 and 14 digit forms). Deliberately stricter than
 * the app's general barcode matcher, which also tries truncated forms - fine
 * for finding a product page, but sharing a photo between products must never
 * match a different number.
 */
export function sameBarcodeForms(gtin: string | null | undefined): string[] {
  const digits = String(gtin ?? "").replace(/\D/g, "");
  const core = digits.replace(/^0+/, "");
  if (!core || core.length > 14) return [];
  const forms = new Set<string>([core]);
  for (const len of [8, 12, 13, 14]) if (core.length <= len) forms.add(core.padStart(len, "0"));
  return Array.from(forms);
}

const candidatesFor = sameBarcodeForms;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// ---------- photos ----------

export type SharedImage = { url: string; source: string };

const SHARED_IMAGE_SOURCES = ["openfoodfacts", "serper"];

export async function findSharedImage(
  gtin: string | null | undefined,
  excludeProductId: string,
): Promise<SharedImage | null> {
  const candidates = candidatesFor(gtin);
  if (!candidates.length) return null;
  try {
    const { data } = await (await admin())
      .from("products")
      .select("image_url, image_source, image_updated_at")
      .in("gtin", candidates)
      .neq("id", excludeProductId)
      .eq("image_status", "official")
      .in("image_source", SHARED_IMAGE_SOURCES)
      .not("image_url", "is", null)
      .order("image_updated_at", { ascending: false, nullsFirst: false })
      .limit(1);
    const row = data?.[0];
    if (!row?.image_url) return null;
    return { url: row.image_url as string, source: row.image_source as string };
  } catch {
    return null;
  }
}

// ---------- passports ----------

// Generic facts about the product itself. Deliberately excludes images (those
// are resolved per product), translations, and anything retailer-specific.
const PASSPORT_COPY_FIELDS = [
  "brand",
  "manufacturer",
  "country_of_origin",
  "category_path",
  "short_description",
  "marketing_description",
  "product_summary",
  "consumer_faqs",
  "ingredients",
  "nutrition",
  "allergens",
  "dimensions",
  "materials",
  "warranty",
  "sustainability",
  "recycling",
  "storage_instructions",
  "preparation_instructions",
  "keywords",
  "images",
  "sources",
  "enrichment_model",
  "enriched_at",
] as const;

export async function findSharedPassport(
  gtin: string | null | undefined,
  excludeProductId: string,
): Promise<Record<string, any> | null> {
  const candidates = candidatesFor(gtin);
  if (!candidates.length) return null;
  try {
    const { data } = await (await admin())
      .from("product_passports")
      .select(PASSPORT_COPY_FIELDS.join(", "))
      .in("gtin", candidates)
      .neq("product_id", excludeProductId)
      .in("enrichment_status", ["enriched", "complete"])
      .order("enriched_at", { ascending: false, nullsFirst: false })
      .limit(1);
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

/** The fields to write onto a product's passport when reusing `shared`. */
export function passportFromShared(shared: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of PASSPORT_COPY_FIELDS) if (shared[f] !== undefined) out[f] = shared[f];
  const prior = Array.isArray(shared.sources) ? shared.sources : [];
  out.sources = [...prior, { provider: "catalogue", reused_at: new Date().toISOString() }];
  return out;
}

// ---------- "nothing found" memory ----------

const MISS_DAYS = 30;

function missKey(gtin: string | null | undefined): string | null {
  const digits = String(gtin ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return validGtin14(digits) ?? digits.padStart(14, "0");
}

export async function isRecentMiss(gtin: string | null | undefined, kind: string): Promise<boolean> {
  const key = missKey(gtin);
  if (!key) return false;
  try {
    const since = new Date(Date.now() - MISS_DAYS * 86_400_000).toISOString();
    const { data, error } = await (await admin())
      .from("catalogue_misses")
      .select("gtin")
      .eq("gtin", key)
      .eq("kind", kind)
      .gte("checked_at", since)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false; // table not created yet -> just search as before
  }
}

export async function recordMiss(gtin: string | null | undefined, kind: string): Promise<void> {
  const key = missKey(gtin);
  if (!key) return;
  try {
    await (await admin())
      .from("catalogue_misses")
      .upsert({ gtin: key, kind, checked_at: new Date().toISOString() }, { onConflict: "gtin,kind" });
  } catch {
    /* best-effort */
  }
}

export async function clearMiss(gtin: string | null | undefined, kind: string): Promise<void> {
  const key = missKey(gtin);
  if (!key) return;
  try {
    await (await admin()).from("catalogue_misses").delete().eq("gtin", key).eq("kind", kind);
  } catch {
    /* best-effort */
  }
}

// ---------- ledger ----------

/** A $0 ledger row, so reuse is visible next to what it saved. */
export function logReuse(activity: string): void {
  void logServiceCall("catalogue", activity, 200, 0);
}
