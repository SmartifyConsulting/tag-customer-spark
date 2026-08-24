// Product Watch Repository — the ONLY module that reads/writes watch rows.
// Watches live on the existing `watchlists` table, extended with snapshot and
// per-rule dedupe columns so the Notification Engine can decide what is new.
//
// Server-only. Never import from client code.

export type WatchRow = {
  id: string;
  retailer_id: string;
  customer_id: string;
  product_id: string;
  status: string;
  notifications_enabled: boolean;
  whatsapp_number: string | null;
  price_when_added: number | null;
  last_known_price: number | null;
  last_known_stock: number | null;
  last_known_intent_score: number | null;
  last_notified_price: number | null;
  last_notified_stock: number | null;
  last_price_drop_sent: string | null;
  last_low_stock_sent: string | null;
  last_last_one_sent: string | null;
  last_back_in_stock_sent: string | null;
  last_high_interest_sent: string | null;
  customer?: { id: string; full_name: string | null; whatsapp_e164: string | null; status: string } | null;
};

const WATCH_COLUMNS =
  "id, retailer_id, customer_id, product_id, status, notifications_enabled, whatsapp_number, " +
  "price_when_added, last_known_price, last_known_stock, last_known_intent_score, " +
  "last_notified_price, last_notified_stock, last_price_drop_sent, last_low_stock_sent, " +
  "last_last_one_sent, last_back_in_stock_sent, last_high_interest_sent, " +
  "customer:customers(id, full_name, whatsapp_e164, status)";

export type ProductSnapshot = {
  price_cents: number | null;
  sale_price_cents: number | null;
  stock_qty: number | null;
  intent_score: number | null;
};

/** The price a shopper actually pays right now. */
export function effectivePrice(product: ProductSnapshot): number | null {
  return product.sale_price_cents ?? product.price_cents ?? null;
}

/**
 * Called when a customer taps "Follow Me" on the scan page — that submission
 * IS the opt-in. Creates the watch or reactivates an existing one, always
 * re-snapshotting the price/stock so future notifications are measured from
 * THIS moment.
 */
export async function createOrRefreshWatch(
  supabase: any,
  input: {
    retailerId: string;
    customerId: string;
    productId: string;
    whatsappNumber: string | null;
    product: ProductSnapshot;
    /** Defaults to active — the web opt-in is the consent. */
    active?: boolean;
  },
): Promise<string | null> {
  const snapshot = {
    whatsapp_number: input.whatsappNumber,
    price_when_added: effectivePrice(input.product),
    last_known_price: effectivePrice(input.product),
    last_known_stock: input.product.stock_qty ?? 0,
    last_known_intent_score: input.product.intent_score ?? 0,
    notifications_enabled: input.active !== false,
    status: input.active === false ? "paused" : "active",
  };


  const { data: existing, error: lookupError } = await supabase
    .from("watchlists")
    .select("id")
    .eq("customer_id", input.customerId)
    .eq("product_id", input.productId)
    .eq("trigger", "any_update")
    .maybeSingle();
  if (lookupError) throw new Error(`Could not find product watch: ${lookupError.message}`);

  if (existing) {
    const { error: updateError } = await supabase
      .from("watchlists")
      .update(snapshot)
      .eq("id", existing.id);
    if (updateError) throw new Error(`Could not activate product watch: ${updateError.message}`);
    return existing.id as string;
  }

  const { data: created, error: createError } = await supabase
    .from("watchlists")
    .insert({
      retailer_id: input.retailerId,
      customer_id: input.customerId,
      product_id: input.productId,
      trigger: "any_update",
      channel: "whatsapp",
      ...snapshot,
    })
    .select("id")
    .maybeSingle();
  if (createError) throw new Error(`Could not create product watch: ${createError.message}`);
  if (!created?.id) throw new Error("Could not create product watch");

  return created.id as string;
}

/** Every active, notifiable watcher of a product. */
export async function listActiveWatchers(supabase: any, productId: string): Promise<WatchRow[]> {
  const { data, error } = await supabase
    .from("watchlists")
    .select(WATCH_COLUMNS)
    .eq("product_id", productId)
    .eq("status", "active")
    .eq("notifications_enabled", true);
  if (error) throw new Error(`Could not load active product watches: ${error.message}`);
  return (data ?? []) as WatchRow[];
}

/** Records that a rule fired for this watcher, so it will not fire twice. */
export async function markNotified(
  supabase: any,
  watchId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("watchlists")
    .update({ ...patch, last_fired_at: new Date().toISOString() })
    .eq("id", watchId);
}

/**
 * Stores the values the watcher has now "seen". Rules compare against these,
 * which is what re-arms a rule after the condition clears (e.g. stock recovers
 * above the low-stock threshold).
 */
export async function updateSnapshot(
  supabase: any,
  watchId: string,
  product: ProductSnapshot,
  otherInterestCount?: number,
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_known_price: effectivePrice(product),
    last_known_stock: product.stock_qty ?? 0,
    last_known_intent_score: product.intent_score ?? 0,
  };
  await supabase.from("watchlists").update(patch).eq("id", watchId);
}

/** Resolves the number to message for a watch row. */
export function watcherPhone(watch: WatchRow): string | null {
  return watch.customer?.whatsapp_e164 ?? watch.whatsapp_number ?? null;
}

/** A watcher is contactable only when they are still subscribed. */
export function isContactable(watch: WatchRow): boolean {
  if (!watcherPhone(watch)) return false;
  if (watch.customer && watch.customer.status !== "subscribed") return false;
  return true;
}

/**
 * How many OTHER customers currently have an active interest in this
 * product — the literal "someone else is looking at this too" signal for
 * the high_interest rule, as opposed to the derived Interest Score.
 */
export async function countOtherActiveInterest(
  supabase: any,
  productId: string,
  excludingCustomerId: string,
): Promise<number> {
  const { count } = await supabase
    .from("customer_interests")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "active")
    .neq("customer_id", excludingCustomerId);
  return count ?? 0;
}

/**
 * The customer tapped "Keep an eye on me" on the scan template. Activates the
 * paused watch and re-snapshots price/stock so alerts measure from this moment.
 */
export async function activateWatch(
  supabase: any,
  watchId: string,
  product: ProductSnapshot,
): Promise<void> {
  await supabase
    .from("watchlists")
    .update({
      status: "active",
      notifications_enabled: true,
      price_when_added: effectivePrice(product),
      last_known_price: effectivePrice(product),
      last_known_stock: product.stock_qty ?? 0,
      last_known_intent_score: product.intent_score ?? 0,
    })
    .eq("id", watchId);
}

/** "It's not you, it's me" — stop alerts for this product only. */
export async function cancelWatch(supabase: any, watchId: string): Promise<void> {
  await supabase
    .from("watchlists")
    .update({ status: "cancelled", notifications_enabled: false })
    .eq("id", watchId);
}

/**
 * "Let's just take it slow" — keep watching, but stay quiet for a while so we
 * do not re-ping about the same product immediately.
 */
export async function deferWatch(supabase: any, watchId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("watchlists")
    .update({
      status: "active",
      notifications_enabled: true,
      last_price_drop_sent: now,
      last_high_interest_sent: now,
      last_last_one_sent: now,
      last_low_stock_sent: now,
    })
    .eq("id", watchId);
}

/** The watch a button reply refers to, for a given customer + product. */
export async function findWatch(
  supabase: any,
  customerId: string,
  productId: string,
): Promise<{ id: string; retailer_id: string } | null> {
  const { data } = await supabase
    .from("watchlists")
    .select("id, retailer_id")
    .eq("customer_id", customerId)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any) ?? null;
}
