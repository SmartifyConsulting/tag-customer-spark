// Server-only helper: enforces the current plan's max_products cap.
// Both the manual "Add Product" form (products.functions.ts) and the
// bulk CSV/onboarding importer (import.functions.ts) create products
// through different code paths, so the check lives here once instead
// of being duplicated (and drifting) in both places.
import { PLANS } from "@/lib/billing/pricing";
import type { TagTier } from "@/lib/tier";

export class ProductCapExceededError extends Error {
  constructor(public readonly limit: number, public readonly current: number) {
    super(
      `Your plan allows up to ${limit} products (you have ${current}). ` +
        `Upgrade to add more.`,
    );
    this.name = "ProductCapExceededError";
  }
}

/**
 * Throws ProductCapExceededError if adding `additionalCount` new products
 * would push the retailer's product count past its plan's max_products.
 * A null max_products means unlimited — always passes.
 */
export async function assertProductCapAvailable(
  supabase: any,
  retailerId: string,
  additionalCount: number,
): Promise<void> {
  const { data: retailer } = await supabase
    .from("retailers")
    .select("tier")
    .eq("id", retailerId)
    .maybeSingle();
  const tier = (retailer?.tier ?? "starter") as TagTier;
  const maxProducts = PLANS[tier]?.max_products ?? null;
  if (maxProducts === null) return;

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("retailer_id", retailerId);
  const current = count ?? 0;

  if (current + additionalCount > maxProducts) {
    throw new ProductCapExceededError(maxProducts, current);
  }
}

/**
 * Bulk-import variant: given how many products already exist and how many
 * have been inserted so far in this batch, returns how many more inserts
 * are allowed before hitting the cap (Infinity if unlimited). The importer
 * calls this once up front, then counts down locally per new row — cheaper
 * than a fresh count() query per row across a 500-row batch.
 */
export async function getRemainingProductCapacity(
  supabase: any,
  retailerId: string,
): Promise<number> {
  const { data: retailer } = await supabase
    .from("retailers")
    .select("tier")
    .eq("id", retailerId)
    .maybeSingle();
  const tier = (retailer?.tier ?? "starter") as TagTier;
  const maxProducts = PLANS[tier]?.max_products ?? null;
  if (maxProducts === null) return Infinity;

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("retailer_id", retailerId);
  const current = count ?? 0;

  return Math.max(0, maxProducts - current);
}
