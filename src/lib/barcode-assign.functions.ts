import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Assign valid, scannable GTIN-13 barcodes to any of the current retailer's
// products that don't have one yet. We use the GS1 "in-store / internal use"
// prefix range (200–299) so these numbers never collide with real registered
// products in the wild. The value is derived deterministically from the
// product id, so re-runs produce the same barcode for the same product.

function hashToDigits(input: string, length: number): string {
  // Simple deterministic 32-bit hash (FNV-1a variant) → digit string.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = "";
  let n = h;
  while (out.length < length) {
    out += (n % 10).toString();
    n = Math.floor(n / 10) || (n ^ 0x9e3779b1) >>> 0;
  }
  return out.slice(0, length);
}

function gtin13CheckDigit(twelve: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = twelve.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return ((10 - (sum % 10)) % 10).toString();
}

function makeGtin13(productId: string): string {
  // 200 prefix = in-store use; 9 digits derived from the product id; +1 check.
  const body = "200" + hashToDigits(productId, 9);
  return body + gtin13CheckDigit(body);
}

async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  // `staff` only ever gets a row for invited team members — a retailer
  // owner who signed up directly never has one, so resolving through it
  // (as this used to) silently broke barcode assignment for every owner
  // account. `user_roles` is the correct, retailer-agnostic source of
  // truth used everywhere else in the app.
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

// Plain function so callers that already run server-side (createProduct,
// the setup wizard's import pipeline) can assign barcodes inline without
// going through the createServerFn RPC wrapper.
export async function assignMissingBarcodesForRetailer(
  supabase: any,
  retailerId: string,
): Promise<{ updated: number; total: number }> {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, sku, gtin")
    .eq("retailer_id", retailerId)
    .is("gtin", null);
  if (error) throw new Error(error.message);

  const rows = products ?? [];
  let updated = 0;
  const usedInBatch = new Set<string>();

  for (const p of rows) {
    let gtin = makeGtin13(p.id);
    // Avoid same-batch collisions (extremely unlikely, but cheap).
    let salt = 0;
    while (usedInBatch.has(gtin)) {
      salt++;
      gtin = makeGtin13(`${p.id}:${salt}`);
    }
    usedInBatch.add(gtin);

    const needsSku = !p.sku || String(p.sku).trim() === "";
    const patch = needsSku
      ? { gtin, barcode_type: "GTIN-13", sku: gtin }
      : { gtin, barcode_type: "GTIN-13" };

    const { error: upErr } = await supabase.from("products").update(patch).eq("id", p.id);
    if (upErr) continue;

    await supabase
      .from("passport_enrichment_queue")
      .upsert({ product_id: p.id } as any, { onConflict: "product_id" });

    updated++;
  }

  return { updated, total: rows.length };
}

export const assignMissingBarcodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailer_id = await resolveRetailerId(supabase, userId);
    if (!retailer_id) throw new Error("No retailer");
    return assignMissingBarcodesForRetailer(supabase, retailer_id);
  });
