// Notification Engine — pure business logic. It decides WHETHER a notification
// should be sent and WHAT variables it carries. It never talks to Twilio: it
// hands a template name + variables to the WhatsApp Service.
//
// Rules (each is independently de-duplicated per watcher):
//   price_drop     current price < the price when that customer scanned
//   low_stock      stock below threshold; re-arms once stock rises above it
//   last_one       stock is exactly 1; re-arms once stock increases
//   back_in_stock  stock went 0 -> >0; re-arms once stock hits 0 again
//   high_interest  >= N other customers actively interested in the same
//                  product; re-arms when the count drops back below N

import { formatMoney } from "@/lib/format";
import { AUTOMATION_BY_KEY, type AutomationKey } from "@/lib/automation";
import { getAutomationSettingsMap } from "@/lib/automation.server";
import {
  countOtherActiveInterest,
  effectivePrice,
  isContactable,
  listActiveWatchers,
  markNotified,
  updateSnapshot,
  watcherPhone,
  type ProductSnapshot,
  type WatchRow,
} from "@/lib/watch-repository.server";
import { sendTemplate } from "@/lib/whatsapp-service.server";

type Product = ProductSnapshot & {
  id: string;
  retailer_id: string;
  name: string;
  display_name: string | null;
  currency: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
};

type Retailer = { id: string; name: string | null; logo_url: string | null };

export type NotificationDecision = {
  rule: AutomationKey;
  watch: WatchRow;
  /** Numbered body placeholders for the approved template. */
  variables: Record<string, string>;
  /** Media header for the template (the scanned product's photo). */
  headerImageUrl: string | null;
  fallbackBody: string;
  /** Columns to persist once the send succeeds (dedupe bookkeeping). */
  patch: Record<string, unknown>;
};

const PRODUCT_COLUMNS =
  "id, retailer_id, name, display_name, price_cents, sale_price_cents, currency, stock_qty, " +
  "intent_score, thumbnail_url, image_url";

// ---------------------------------------------------------------- rules ----

export function checkPriceDrop(
  watch: WatchRow,
  product: Product,
  ctx: { retailerName: string; headerImage: string },
): NotificationDecision | null {
  const current = effectivePrice(product);
  const baseline = watch.price_when_added;
  if (current == null || baseline == null) return null;
  if (current >= baseline) return null;
  // Already told this watcher about this price (or lower).
  if (watch.last_notified_price != null && current >= watch.last_notified_price) return null;

  const productName = product.display_name || product.name;
  const newPrice = formatMoney(current, product.currency ?? "ZAR");
  const oldPrice = formatMoney(baseline, product.currency ?? "ZAR");

  return {
    rule: "price_drop",
    watch,
    // tag_valuechange: 1 = reduced price, 2 = product name, 3 = price at scan time.
    variables: { "1": newPrice, "2": productName, "3": oldPrice },
    headerImageUrl: ctx.headerImage || null,
    fallbackBody: `🏷️ ${ctx.retailerName}: ${productName} dropped to ${newPrice} (was ${oldPrice}). You're watching this one — grab it before it's gone!`,
    patch: { last_notified_price: current, last_price_drop_sent: new Date().toISOString() },
  };
}

export function checkLowStock(
  watch: WatchRow,
  product: Product,
  ctx: { retailerName: string; headerImage: string; threshold: number },
): NotificationDecision | null {
  const stock = product.stock_qty;
  if (stock == null || stock <= 0) return null;
  if (stock >= ctx.threshold) return null;
  // Re-arm rule: only send again once stock has climbed back above the
  // threshold since the last low-stock message.
  if (watch.last_low_stock_sent && (watch.last_known_stock ?? 0) < ctx.threshold) return null;

  const productName = product.display_name || product.name;
  return {
    rule: "low_stock",
    watch,
    variables: { "1": productName, "2": String(stock) },
    headerImageUrl: ctx.headerImage || null,
    fallbackBody: `⚠️ ${ctx.retailerName}: only ${stock} left of ${productName} — the one you're watching.`,
    patch: { last_low_stock_sent: new Date().toISOString(), last_notified_stock: stock },
  };
}

export function checkLastOne(
  watch: WatchRow,
  product: Product,
  ctx: { retailerName: string; headerImage: string },
): NotificationDecision | null {
  if (product.stock_qty !== 1) return null;
  // Only once — re-arms when stock increases again (last_known_stock > 1).
  if (watch.last_last_one_sent && (watch.last_known_stock ?? 0) <= 1) return null;

  const productName = product.display_name || product.name;
  return {
    rule: "last_one",
    watch,
    variables: { "1": productName },
    headerImageUrl: ctx.headerImage || null,
    fallbackBody: `🔥 ${ctx.retailerName}: this is the LAST ONE of ${productName}. Don't miss it.`,
    patch: { last_last_one_sent: new Date().toISOString(), last_notified_stock: 1 },
  };
}

export function checkBackInStock(
  watch: WatchRow,
  product: Product,
  ctx: { retailerName: string; headerImage: string },
): NotificationDecision | null {
  const stock = product.stock_qty ?? 0;
  if (stock <= 0) return null;
  // Transition from sold out -> available, based on what this watcher last saw.
  if ((watch.last_known_stock ?? 0) > 0) return null;
  if (watch.last_back_in_stock_sent && (watch.last_known_stock ?? 0) > 0) return null;

  const productName = product.display_name || product.name;
  return {
    rule: "back_in_stock",
    watch,
    variables: { "1": productName },
    headerImageUrl: ctx.headerImage || null,
    fallbackBody: `✅ ${ctx.retailerName}: ${productName} is back in stock! You asked us to let you know.`,
    patch: { last_back_in_stock_sent: new Date().toISOString(), last_notified_stock: stock },
  };
}

export function checkHighInterest(
  watch: WatchRow,
  product: Product,
  ctx: { retailerName: string; headerImage: string; threshold: number; otherInterestCount: number },
): NotificationDecision | null {
  const count = ctx.otherInterestCount;
  if (count < ctx.threshold) return null;
  // Re-arm rule: the count must have dropped back below the threshold since
  // the previous high-interest message.
  if (watch.last_high_interest_sent && Number(watch.last_known_interest_count ?? 0) >= ctx.threshold) return null;

  const productName = product.display_name || product.name;
  return {
    rule: "high_interest",
    watch,
    variables: { "1": productName, "2": String(count) },
    headerImageUrl: ctx.headerImage || null,
    fallbackBody:
      count === 1
        ? `📈 ${ctx.retailerName}: someone else is looking at ${productName} too — the one you're watching. If you want it, don't wait.`
        : `📈 ${ctx.retailerName}: ${count} other people are looking at ${productName} — the one you're watching. If you want it, don't wait.`,
    patch: { last_high_interest_sent: new Date().toISOString() },
  };
}

// ------------------------------------------------------------ evaluation ----

/**
 * Runs every enabled rule for every active watcher of a product and dispatches
 * the resulting messages. Best-effort: one failed send never blocks the others
 * or the caller's own product-update flow.
 */
export async function evaluateProduct(supabase: any, productId: string): Promise<{ sent: number }> {
  const { data: product } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { sent: 0 };

  const watchers = await listActiveWatchers(supabase, productId);
  if (!watchers.length) return { sent: 0 };

  const [{ data: retailer }, settings] = await Promise.all([
    supabase.from("retailers").select("id, name, logo_url").eq("id", (product as Product).retailer_id).maybeSingle(),
    getAutomationSettingsMap(supabase, (product as Product).retailer_id),
  ]);

  const ctxBase = {
    retailerName: (retailer as Retailer | null)?.name ?? "Tag",
    // Product photo is the header on the tag_* templates; the retailer logo is
    // only a fallback when the product has no image at all.
    headerImage:
      (product as Product).thumbnail_url ||
      (product as Product).image_url ||
      (retailer as Retailer | null)?.logo_url ||
      "",
  };

  let sent = 0;
  for (const watch of watchers) {
    if (!isContactable(watch)) continue;

    const decisions: NotificationDecision[] = [];
    const p = product as Product;

    if (settings.price_drop.enabled) {
      const d = checkPriceDrop(watch, p, ctxBase);
      if (d) decisions.push(d);
    }
    if (settings.back_in_stock.enabled) {
      const d = checkBackInStock(watch, p, ctxBase);
      if (d) decisions.push(d);
    }
    if (settings.last_one.enabled) {
      const d = checkLastOne(watch, p, ctxBase);
      if (d) decisions.push(d);
    }
    // "Last one" already covers stock === 1, so skip the duplicate low-stock ping.
    if (settings.low_stock.enabled && !decisions.some((x) => x.rule === "last_one")) {
      const d = checkLowStock(watch, p, {
        ...ctxBase,
        threshold: Number(settings.low_stock.threshold ?? AUTOMATION_BY_KEY.low_stock.threshold ?? 3),
      });
      if (d) decisions.push(d);
    }
    let otherInterestCount = 0;
    if (settings.high_interest.enabled) {
      otherInterestCount = await countOtherActiveInterest(supabase, p.id, watch.customer_id);
      const d = checkHighInterest(watch, p, {
        ...ctxBase,
        threshold: Number(settings.high_interest.threshold ?? AUTOMATION_BY_KEY.high_interest.threshold ?? 1),
        otherInterestCount,
      });
      if (d) decisions.push(d);
    }

    for (const decision of decisions) {
      const ok = await dispatch(supabase, decision, p, settings[decision.rule].template_name);
      if (ok) sent++;
    }

    // Always advance the snapshot so rules re-arm correctly next time.
    await updateSnapshot(supabase, watch.id, product as ProductSnapshot, otherInterestCount);
  }

  return { sent };
}

async function dispatch(
  supabase: any,
  decision: NotificationDecision,
  product: Product,
  templateName: string,
): Promise<boolean> {
  const to = watcherPhone(decision.watch);
  if (!to) return false;

  let result;
  try {
    result = await sendTemplate({
      templateName,
      to,
      variables: decision.variables,
      headerImageUrl: decision.headerImageUrl,
      fallbackBody: decision.fallbackBody,
    });
  } catch (e: any) {
    console.warn("[notification-engine] send threw", decision.rule, e?.message ?? e);
    result = { ok: false, status: 0, error: e?.message ?? "Send failed" } as const;
  }

  await supabase.from("notification_history").insert({
    retailer_id: decision.watch.retailer_id,
    customer_id: decision.watch.customer_id,
    channel: "whatsapp",
    payload: {
      rule: decision.rule,
      template: templateName,
      product_id: product.id,
      body: decision.fallbackBody,
    },
    status: result.ok ? "sent" : "failed",
    sent_at: result.ok ? new Date().toISOString() : null,
    error: result.ok ? null : result.error,
    provider_message_sid: (result as any).sid ?? null,
  });

  if (result.ok) {
    await markNotified(supabase, decision.watch.id, decision.patch);
  }
  return result.ok;
}

/**
 * Sweeps every product that currently has active watchers. Used by the
 * scheduled tick so rules also fire for changes that bypass the app
 * (bulk imports, direct stock syncs, intent-score recomputes).
 */
export async function sweepAllWatchedProducts(supabase: any, limit = 200): Promise<{ products: number; sent: number }> {
  const { data: rows } = await supabase
    .from("watchlists")
    .select("product_id")
    .eq("status", "active")
    .eq("notifications_enabled", true)
    .limit(2000);

  const productIds = Array.from(new Set((rows ?? []).map((r: any) => r.product_id))).slice(0, limit);
  let sent = 0;
  for (const id of productIds) {
    try {
      const res = await evaluateProduct(supabase, id as string);
      sent += res.sent;
    } catch (e: any) {
      console.warn("[notification-engine] sweep failed for", id, e?.message ?? e);
    }
  }
  return { products: productIds.length, sent };
}
