// Daily Manager Summary — one evening WhatsApp digest per retailer.
// Pure aggregation + a single call into the WhatsApp Service.

import { getAutomationSettingsMap } from "@/lib/automation.server";
import { sendTemplate } from "@/lib/whatsapp-service.server";

export type DailySummary = {
  scannedToday: number;
  topIntentProduct: string;
  priceChanges: number;
  lowStock: number;
  backInStock: number;
  soldOut: number;
  notificationsSent: number;
};

function startOfToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function buildDailySummary(supabase: any, retailerId: string): Promise<DailySummary> {
  const since = startOfToday();

  const [scans, products, notifications, priceEvents] = await Promise.all([
    supabase
      .from("qr_scans")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailerId)
      .gte("scanned_at", since),
    supabase
      .from("products")
      .select("name, display_name, stock_qty, low_stock_threshold, intent_score")
      .eq("retailer_id", retailerId)
      .eq("status", "active"),
    supabase
      .from("notification_history")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailerId)
      .gte("created_at", since),
    supabase
      .from("watchlist_events")
      .select("trigger, created_at")
      .eq("retailer_id", retailerId)
      .gte("created_at", since),
  ]);

  const rows = (products.data ?? []) as any[];
  const top = rows
    .slice()
    .sort((a, b) => Number(b.intent_score ?? 0) - Number(a.intent_score ?? 0))[0];

  const events = (priceEvents.data ?? []) as any[];

  return {
    scannedToday: scans.count ?? 0,
    topIntentProduct: top ? top.display_name || top.name : "—",
    priceChanges: events.filter((e) => e.trigger === "on_sale" || e.trigger === "price_drop_below").length,
    lowStock: rows.filter(
      (p) => (p.stock_qty ?? 0) > 0 && (p.stock_qty ?? 0) <= (p.low_stock_threshold ?? 3),
    ).length,
    backInStock: events.filter((e) => e.trigger === "back_in_stock").length,
    soldOut: rows.filter((p) => (p.stock_qty ?? 0) === 0).length,
    notificationsSent: notifications.count ?? 0,
  };
}

export function summaryText(retailerName: string, s: DailySummary): string {
  return (
    `📊 ${retailerName} — today's Tag summary\n` +
    `• Products scanned: ${s.scannedToday}\n` +
    `• Highest intent: ${s.topIntentProduct}\n` +
    `• Price changes: ${s.priceChanges}\n` +
    `• Running low: ${s.lowStock}\n` +
    `• Back in stock: ${s.backInStock}\n` +
    `• Sold out: ${s.soldOut}\n` +
    `• Notifications sent: ${s.notificationsSent}`
  );
}

/** Sends the digest to every retailer that has the automation enabled. */
export async function sendDailySummaries(supabase: any): Promise<{ retailers: number; sent: number }> {
  const { data: retailers } = await supabase
    .from("retailers")
    .select("id, name, logo_url")
    .eq("status", "active");

  let sent = 0;
  for (const retailer of (retailers ?? []) as any[]) {
    try {
      const settings = await getAutomationSettingsMap(supabase, retailer.id);
      if (!settings.daily_summary.enabled) continue;

      // Managers receive the digest on the WhatsApp number in their profile.
      const { data: staff } = await supabase
        .from("staff")
        .select("user_id, role, status")
        .eq("retailer_id", retailer.id)
        .eq("status", "active")
        .in("role", ["retail_admin", "store_manager"]);

      const userIds = ((staff ?? []) as any[]).map((s) => s.user_id).filter(Boolean);
      if (!userIds.length) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, whatsapp_e164")
        .in("id", userIds);

      const numbers = ((profiles ?? []) as any[]).map((p) => p.whatsapp_e164).filter(Boolean);
      if (!numbers.length) continue;

      const summary = await buildDailySummary(supabase, retailer.id);
      const body = summaryText(retailer.name ?? "Your store", summary);

      for (const to of numbers) {
        const result = await sendTemplate({
          templateName: settings.daily_summary.template_name,
          to,
          variables: {
            "1": retailer.logo_url ?? "",
            "2": retailer.name ?? "Your store",
            "3": String(summary.scannedToday),
            "4": summary.topIntentProduct,
            "5": String(summary.priceChanges),
            "6": String(summary.lowStock),
            "7": String(summary.backInStock),
            "8": String(summary.soldOut),
            "9": String(summary.notificationsSent),
          },
          fallbackBody: body,
        });
        if (result.ok) sent++;
      }
    } catch (e: any) {
      console.warn("[daily-summary] failed for retailer", retailer.id, e?.message ?? e);
    }
  }

  return { retailers: (retailers ?? []).length, sent };
}
