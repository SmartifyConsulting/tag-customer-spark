// Server-only: turns a queued `watchlist_events` row (fired by the
// `trg_watchlist_on_product_change` DB trigger when a product's price or
// stock changes) into an actual WhatsApp send. Call `processWatchlistEvents`
// right after any code path that updates products.price_cents,
// products.sale_price_cents, or products.stock_qty.
//
// Sends only approved TAG templates (see whatsapp-templates.server.ts). The
// product photo is the header image, with the retailer's logo as fallback, so
// each retailer's messages still look branded.
import { sendTemplate } from "@/lib/whatsapp-service.server";
import { isPublicMediaUrl } from "@/lib/whatsapp-templates.server";
import { formatMoney } from "@/lib/format";

type EventType = "sale" | "back_in_stock" | "low_stock";

function detectEventType(trigger: string, payload: any): EventType | null {
  if (payload && typeof payload === "object" && "new_price_cents" in payload) return "sale";
  if (trigger === "back_in_stock") return "back_in_stock";
  if (trigger === "low_stock") return "low_stock";
  return null;
}

// Processes every unsent watchlist_events row for one product. Best-effort —
// a send failure for one customer never blocks the others or the caller's
// own product-update flow.
export async function processWatchlistEvents(supabase: any, productId: string): Promise<void> {
  const { data: events } = await supabase
    .from("watchlist_events")
    .select("id, watchlist_id, retailer_id, trigger, payload, status, watchlists!inner(id, customer_id, product_id)")
    .eq("status", "queued")
    .eq("watchlists.product_id", productId);

  if (!events?.length) return;

  const { data: product } = await supabase
    .from("products")
    .select("id, name, display_name, price_cents, sale_price_cents, currency, stock_qty, thumbnail_url, image_url")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return;

  for (const event of events as any[]) {
    try {
      await processOne(supabase, event, product);
    } catch (e: any) {
      console.warn("[watchlist-dispatch] event failed", event.id, e?.message ?? e);
    }
  }
}

async function processOne(supabase: any, event: any, product: any): Promise<void> {
  const type = detectEventType(event.trigger, event.payload);
  if (!type) {
    await supabase.from("watchlist_events").update({ status: "skipped" }).eq("id", event.id);
    return;
  }

  const [{ data: customer }, { data: retailer }] = await Promise.all([
    supabase.from("customers").select("id, whatsapp_e164, full_name, status").eq("id", event.watchlists.customer_id).maybeSingle(),
    supabase.from("retailers").select("id, name, logo_url").eq("id", event.retailer_id).maybeSingle(),
  ]);

  if (!customer || customer.status !== "subscribed" || !customer.whatsapp_e164) {
    await supabase.from("watchlist_events").update({ status: "skipped" }).eq("id", event.id);
    return;
  }

  const productName = product.display_name || product.name;
  const retailerName = retailer?.name || "Tag";
  // IMAGE header on the tag_* templates — product photo first, retailer logo
  // as fallback, and it must be a public https URL.
  const headerImage =
    [product.thumbnail_url, product.image_url, retailer?.logo_url].find((u) => isPublicMediaUrl(u)) ?? "";

  // Only price changes have an approved template on this path. Restock and
  // low-stock alerts are handled by the notification engine's approved
  // templates, so skip them here rather than sending something WhatsApp
  // will reject.
  if (type !== "sale") {
    await supabase.from("watchlist_events").update({ status: "skipped" }).eq("id", event.id);
    return;
  }

  const newPrice = formatMoney(event.payload.new_price_cents, product.currency);
  const oldPrice = formatMoney(event.payload.old_price_cents, product.currency);
  const body = `🏷️ ${retailerName}: ${productName} just dropped to ${newPrice} (was ${oldPrice}). You watched this one — grab it before it's gone!`;

  const result = await sendTemplate({
    templateName: "tag_valuechange",
    to: customer.whatsapp_e164,
    variables: { oldPrice, newPrice },
    headerImageUrl: headerImage || null,
  });


  const { data: history } = await supabase
    .from("notification_history")
    .insert({
      retailer_id: event.retailer_id,
      customer_id: customer.id,
      channel: "whatsapp",
      payload: { type, product_id: product.id, body },
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
      error: result.ok ? null : result.error,
      provider_message_sid: result.sid ?? null,
    })
    .select("id")
    .single();

  await supabase
    .from("watchlist_events")
    .update({ status: result.ok ? "sent" : "failed", notification_id: history?.id ?? null })
    .eq("id", event.id);
}
