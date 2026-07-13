// Server-only: turns a queued `watchlist_events` row (fired by the
// `trg_watchlist_on_product_change` DB trigger when a product's price or
// stock changes) into an actual WhatsApp send. Call `processWatchlistEvents`
// right after any code path that updates products.price_cents,
// products.sale_price_cents, or products.stock_qty.
//
// Uses shared, global Content Templates (same for every retailer) — see
// TWILIO_TEMPLATE_SALE_SID / TWILIO_TEMPLATE_RESTOCK_SID /
// TWILIO_TEMPLATE_LOWSTOCK_SID. The retailer's logo is passed as the
// template's header image so each retailer's messages still look branded.
import { sendWhatsApp } from "@/lib/whatsapp.server";
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
  const headerImage = retailer?.logo_url || product.thumbnail_url || product.image_url || "";
  const retailerName = retailer?.name || "Tag";

  const sidByType: Record<EventType, string | undefined> = {
    sale: process.env.TWILIO_TEMPLATE_SALE_SID,
    back_in_stock: process.env.TWILIO_TEMPLATE_RESTOCK_SID,
    low_stock: process.env.TWILIO_TEMPLATE_LOWSTOCK_SID,
  };
  const contentSid = sidByType[type];

  let body: string | undefined;
  let contentVariables: Record<string, string> | undefined;

  if (type === "sale") {
    const newPrice = formatMoney(event.payload.new_price_cents, product.currency);
    const oldPrice = formatMoney(event.payload.old_price_cents, product.currency);
    body = `🏷️ ${retailerName}: ${productName} just dropped to ${newPrice} (was ${oldPrice}). You watched this one — grab it before it's gone!`;
    contentVariables = { "1": headerImage, "2": retailerName, "3": productName, "4": `${newPrice} (was ${oldPrice})` };
  } else if (type === "back_in_stock") {
    body = `✅ ${retailerName}: ${productName} is back in stock! You asked us to let you know.`;
    contentVariables = { "1": headerImage, "2": retailerName, "3": productName };
  } else {
    body = `⚠️ ${retailerName}: only ${event.payload.stock_qty ?? "a few"} left of ${productName} — the one you're watching. Don't miss out.`;
    contentVariables = { "1": headerImage, "2": retailerName, "3": productName, "4": String(event.payload.stock_qty ?? "") };
  }

  const result = contentSid
    ? await sendWhatsApp({ to: customer.whatsapp_e164, contentSid, contentVariables })
    : await sendWhatsApp({ to: customer.whatsapp_e164, body }); // fallback: freeform (only works within 24h session window)

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
