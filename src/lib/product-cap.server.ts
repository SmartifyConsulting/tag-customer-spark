// Server-only helpers: enforce the current plan's numeric caps
// (products, stores, staff seats). Each is read in the pricing table but
// otherwise unenforced until wired in here — see the individual
// functions below for where each one is called from.
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

export class StoreCapExceededError extends Error {
  constructor(public readonly limit: number, public readonly current: number) {
    super(`Your plan allows up to ${limit} store${limit === 1 ? "" : "s"} (you have ${current}). Upgrade to add more.`);
    this.name = "StoreCapExceededError";
  }
}

/**
 * Throws StoreCapExceededError if creating one more store would exceed
 * the retailer's plan's max_stores. Closed stores don't count against the
 * cap — only active/pending ones actually occupy a "slot."
 */
export async function assertStoreCapAvailable(supabase: any, retailerId: string): Promise<void> {
  const { data: retailer } = await supabase
    .from("retailers")
    .select("tier")
    .eq("id", retailerId)
    .maybeSingle();
  const tier = (retailer?.tier ?? "starter") as TagTier;
  const maxStores = PLANS[tier]?.max_stores ?? null;
  if (maxStores === null) return;

  const { count } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("retailer_id", retailerId)
    .neq("status", "closed");
  const current = count ?? 0;

  if (current + 1 > maxStores) {
    throw new StoreCapExceededError(maxStores, current);
  }
}

export class StaffSeatCapExceededError extends Error {
  constructor(public readonly limit: number, public readonly current: number) {
    super(`Your plan allows up to ${limit} staff seat${limit === 1 ? "" : "s"} (you have ${current}). Upgrade to invite more.`);
    this.name = "StaffSeatCapExceededError";
  }
}

/**
 * Throws StaffSeatCapExceededError if inviting one more staff member would
 * exceed the retailer's plan's staff_seats. staff_seats counts every login
 * on the workspace, matching the "User logins" row on the pricing
 * comparison table — but the owner who signed up first is provisioned via
 * user_roles only (see complete_signup in migration 20260713090000) and
 * never gets a row in `staff` at all, so the count starts at 1 for them
 * before counting invited/active staff rows. A disabled staff row has
 * freed its seat back up; an invited (not yet accepted) row still holds
 * one, same as an active one — otherwise a retailer could stack up
 * unlimited pending invites past their seat cap.
 */
export async function assertStaffSeatAvailable(supabase: any, retailerId: string): Promise<void> {
  const { data: retailer } = await supabase
    .from("retailers")
    .select("tier")
    .eq("id", retailerId)
    .maybeSingle();
  const tier = (retailer?.tier ?? "starter") as TagTier;
  const seatLimit = PLANS[tier]?.staff_seats ?? null;
  if (seatLimit === null) return;

  const { count } = await supabase
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("retailer_id", retailerId)
    .neq("status", "disabled");
  const current = 1 + (count ?? 0); // +1 for the owner, who has no staff row

  if (current + 1 > seatLimit) {
    throw new StaffSeatCapExceededError(seatLimit, current);
  }
}
