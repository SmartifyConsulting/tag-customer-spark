// Tags every paid call made while working on a product with that product and
// its store, so the Token Ledger can say what each call was for.
//
// Entry points (passport enrichment, image resolution, ...) wrap their work in
// withProductUsage(); ai-usage.server.ts reads currentUsageContext() when it
// records a call. Request-scoped via AsyncLocalStorage, so concurrent products
// (bulk runs process several at once) never see each other's context.

import { AsyncLocalStorage } from "node:async_hooks";

export type UsageContext = {
  productId: string;
  productName: string | null;
  storeId: string | null;
  storeName: string | null;
  retailerId: string | null;
  retailerName: string | null;
};

const als = new AsyncLocalStorage<UsageContext>();

// Which bulk action or background job a call belongs to ("Re-enrich all",
// "Scheduled enrichment", ...), so the ledger can show what one press cost.
// Set once at the start of an entry point; it then applies to everything that
// entry point awaits, and to nothing else.
const runAls = new AsyncLocalStorage<string>();

export function setRunLabel(label: string): void {
  runAls.enterWith(label);
}

export function currentRunLabel(): string | undefined {
  return runAls.getStore();
}

// Who triggered the work. Background jobs never set this, so their calls have no user.
const userAls = new AsyncLocalStorage<string>();

export function setUsageUser(userId: string | null | undefined): void {
  if (userId) userAls.enterWith(userId);
}

export function currentUsageUser(): string | undefined {
  return userAls.getStore();
}

export function currentUsageContext(): UsageContext | undefined {
  return als.getStore();
}

async function loadContext(productId: string): Promise<UsageContext | undefined> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await (supabaseAdmin as any)
      .from("products")
      .select("id, name, retailer_id, store_id")
      .eq("id", productId)
      .maybeSingle();
    if (!p) return undefined;
    const [store, retailer] = await Promise.all([
      p.store_id
        ? (supabaseAdmin as any).from("stores").select("name").eq("id", p.store_id).maybeSingle()
        : Promise.resolve({ data: null }),
      p.retailer_id
        ? (supabaseAdmin as any).from("retailers").select("name").eq("id", p.retailer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      productId: p.id as string,
      productName: (p.name as string | null) ?? null,
      storeId: (p.store_id as string | null) ?? null,
      storeName: (store.data?.name as string | null) ?? null,
      retailerId: (p.retailer_id as string | null) ?? null,
      retailerName: (retailer.data?.name as string | null) ?? null,
    };
  } catch {
    return undefined; // attribution is best-effort; never block the real work
  }
}

/** Runs `fn` with calls attributed to `productId`. Reuses an outer context for the same product. */
export async function withProductUsage<T>(productId: string, fn: () => Promise<T>): Promise<T> {
  const outer = als.getStore();
  if (outer?.productId === productId) return fn();
  const ctx = await loadContext(productId);
  return ctx ? als.run(ctx, fn) : fn();
}
