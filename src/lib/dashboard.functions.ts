import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationTypePerf = {
  type: "sale" | "low_stock" | "back_in_stock" | "promotion" | "custom";
  label: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  redeemed: number;
  ctr: number;
};

export type SignalContribution = {
  key:
    | "scans"
    | "repeat_scans"
    | "time_on_page"
    | "unique_viewers"
    | "watchlist"
    | "notif_engagement"
    | "conversion_rate"
    | "cart_rate"
    | "price_impact";
  label: string;
  pct: number;
};

export type SignalProductBreakdown = {
  product_id: string;
  name: string;
  image_url: string | null;
  raw: number;
  contribution_pct: number;
};



export type DashboardOverview = {
  kpis: {
    todaysScans: number;
    todaysScansDelta: number;
    customersWaiting: number;
    revenueRecoveredCents: number;
    currency: string;
    notificationsSent: number;
    notificationConversionPct: number;
    lowStockCount: number;
    onPromotionCount: number;
    topProductName: string | null;
    topProductInterestCount: number;
  };
  scansDaily: { date: string; count: number }[];
  scansWeekly: { weekStart: string; count: number }[];
  scansMonthly: { month: string; count: number }[];
  customerGrowth: { date: string; total: number }[];
  topProducts: { id: string; name: string; interestCount: number; stockQty: number }[];
  lowStockProducts: { id: string; name: string; stockQty: number; lowStockThreshold: number }[];
  promotionProducts: { id: string; name: string; discountPct: number; endsAt: string | null }[];
  notificationPerf: { date: string; sent: number; delivered: number; read: number }[];
  recentActivity: {
    id: string;
    type: "scan" | "opt_in" | "notification" | "recovery";
    at: string;
    label: string;
    sublabel: string | null;
  }[];
  hasRetailerContext: boolean;
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekStartKey(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  x.setUTCDate(x.getUTCDate() - diff);
  return x.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardOverview> => {
    const { supabase } = context;
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const days14 = new Date(todayStart.getTime() - 13 * 24 * 60 * 60 * 1000);
    const days30 = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
    const weeks12 = new Date(todayStart.getTime() - 11 * 7 * 24 * 60 * 60 * 1000);
    const months12 = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)
    );

    // Parallel queries — RLS scopes everything to the user's retailer
    const [
      interestsAll,
      interestsActiveCount,
      productsAll,
      promosActive,
      recoveriesAll,
      notifAll,
      recentScans,
      recentOptIns,
      recentNotifs,
      recentRecoveries,
    ] = await Promise.all([
      supabase
        .from("customer_interests")
        .select("id, product_id, created_at, qr_tag_id")
        .gte("created_at", months12.toISOString()),
      supabase
        .from("customer_interests")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("products")
        .select("id, name, stock_qty, low_stock_threshold, currency, status"),
      supabase
        .from("promotion_events")
        .select("id, name, product_id, discount_pct, ends_at, status")
        .eq("status", "active")
        .order("ends_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("sales_recoveries")
        .select("amount_cents, currency, recovered_at, status")
        .eq("status", "attributed"),
      supabase
        .from("notification_history")
        .select("id, status, sent_at")
        .gte("sent_at", days14.toISOString()),
      supabase
        .from("customer_interests")
        .select("id, created_at, products(name), customers(full_name)")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("customers")
        .select("id, full_name, opted_in_at")
        .eq("status", "subscribed")
        .order("opted_in_at", { ascending: false })
        .limit(4),
      supabase
        .from("notification_history")
        .select("id, sent_at, status, customers(full_name)")
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(4),
      supabase
        .from("sales_recoveries")
        .select("id, amount_cents, currency, recovered_at, customers(full_name), products(name)")
        .order("recovered_at", { ascending: false })
        .limit(4),
    ]);

    const products = productsAll.data ?? [];
    const productById = new Map(products.map((p) => [p.id, p]));
    const interests = interestsAll.data ?? [];
    const notifs = notifAll.data ?? [];
    const promos = promosActive.data ?? [];
    const recoveries = recoveriesAll.data ?? [];

    const hasRetailerContext = products.length > 0 || interests.length > 0 || notifs.length > 0;
    const currency = products[0]?.currency ?? "ZAR";

    // KPI: today's scans + delta
    const todaysScans = interests.filter((i) => i.created_at && new Date(i.created_at) >= todayStart).length;
    const yesterdaysScans = interests.filter((i) => {
      if (!i.created_at) return false;
      const d = new Date(i.created_at);
      return d >= yesterdayStart && d < todayStart;
    }).length;
    const todaysScansDelta = todaysScans - yesterdaysScans;

    const lowStockProductsRaw = products
      .filter((p) => p.status === "active" && (p.stock_qty ?? 0) <= (p.low_stock_threshold ?? 0))
      .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0));

    const onPromotionCount = new Set(
      promos.map((p) => p.product_id).filter((x): x is string => !!x)
    ).size;

    const revenueRecoveredCents = recoveries.reduce((s, r) => s + (r.amount_cents ?? 0), 0);

    const notificationsSent = notifs.length;
    const delivered = notifs.filter((n) => ["delivered", "read"].includes(n.status as string)).length;
    const read = notifs.filter((n) => n.status === "read").length;
    const notificationConversionPct =
      notificationsSent > 0 ? Math.round((read / notificationsSent) * 100) : 0;

    // Top products by interest count (lifetime within 12mo window)
    const interestByProduct = new Map<string, number>();
    for (const i of interests) {
      if (!i.product_id) continue;
      interestByProduct.set(i.product_id, (interestByProduct.get(i.product_id) ?? 0) + 1);
    }
    const topProducts = [...interestByProduct.entries()]
      .map(([id, count]) => {
        const p = productById.get(id);
        return {
          id,
          name: p?.name ?? "Unknown",
          interestCount: count,
          stockQty: p?.stock_qty ?? 0,
        };
      })
      .sort((a, b) => b.interestCount - a.interestCount)
      .slice(0, 5);

    // Time series — pre-fill buckets so charts always render
    const scansDaily: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      scansDaily.push({ date: dayKey(d), count: 0 });
    }
    const dailyMap = new Map(scansDaily.map((b) => [b.date, b]));
    for (const i of interests) {
      if (!i.created_at) continue;
      const d = new Date(i.created_at);
      if (d < days14) continue;
      const k = dayKey(d);
      const b = dailyMap.get(k);
      if (b) b.count++;
    }

    const scansWeekly: { weekStart: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      scansWeekly.push({ weekStart: weekStartKey(d), count: 0 });
    }
    const weeklyMap = new Map(scansWeekly.map((b) => [b.weekStart, b]));
    for (const i of interests) {
      if (!i.created_at) continue;
      const d = new Date(i.created_at);
      if (d < weeks12) continue;
      const b = weeklyMap.get(weekStartKey(d));
      if (b) b.count++;
    }

    const scansMonthly: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      scansMonthly.push({ month: monthKey(d), count: 0 });
    }
    const monthlyMap = new Map(scansMonthly.map((b) => [b.month, b]));
    for (const i of interests) {
      if (!i.created_at) continue;
      const d = new Date(i.created_at);
      if (d < months12) continue;
      const b = monthlyMap.get(monthKey(d));
      if (b) b.count++;
    }

    // Customer growth: pull last-30-day customers and cumulative total
    const { data: custTotalRow } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true });
    const totalCustomers = (custTotalRow as unknown as { count?: number })?.count ?? 0;

    const { data: recentCustomers } = await supabase
      .from("customers")
      .select("opted_in_at")
      .gte("opted_in_at", days30.toISOString());

    const customerGrowth: { date: string; total: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      customerGrowth.push({ date: dayKey(d), total: 0 });
    }
    const growthMap = new Map(customerGrowth.map((b) => [b.date, b]));
    const newPerDay = new Map<string, number>();
    for (const c of recentCustomers ?? []) {
      if (!c.opted_in_at) continue;
      const k = dayKey(new Date(c.opted_in_at));
      newPerDay.set(k, (newPerDay.get(k) ?? 0) + 1);
    }
    const newInWindow = [...newPerDay.values()].reduce((s, n) => s + n, 0);
    let running = totalCustomers - newInWindow;
    for (const b of customerGrowth) {
      running += newPerDay.get(b.date) ?? 0;
      b.total = running;
    }

    // Notification performance — 14 day series
    const notificationPerf: { date: string; sent: number; delivered: number; read: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      notificationPerf.push({ date: dayKey(d), sent: 0, delivered: 0, read: 0 });
    }
    const perfMap = new Map(notificationPerf.map((b) => [b.date, b]));
    for (const n of notifs) {
      if (!n.sent_at) continue;
      const k = dayKey(new Date(n.sent_at));
      const b = perfMap.get(k);
      if (!b) continue;
      b.sent++;
      if (n.status === "delivered" || n.status === "read") b.delivered++;
      if (n.status === "read") b.read++;
    }

    // Recent activity feed — merge & sort
    const feed: DashboardOverview["recentActivity"] = [];
    for (const r of recentScans.data ?? []) {
      const productName = (r as { products?: { name?: string } | null }).products?.name ?? "a product";
      const customerName =
        (r as { customers?: { full_name?: string } | null }).customers?.full_name ?? "Someone";
      feed.push({
        id: `scan-${r.id}`,
        type: "scan",
        at: r.created_at as string,
        label: `${customerName} tagged ${productName}`,
        sublabel: null,
      });
    }
    for (const c of recentOptIns.data ?? []) {
      feed.push({
        id: `optin-${c.id}`,
        type: "opt_in",
        at: c.opted_in_at as string,
        label: `${c.full_name ?? "New customer"} opted in`,
        sublabel: "WhatsApp updates enabled",
      });
    }
    for (const n of recentNotifs.data ?? []) {
      if (!n.sent_at) continue;
      const name =
        (n as { customers?: { full_name?: string } | null }).customers?.full_name ?? "a customer";
      feed.push({
        id: `notif-${n.id}`,
        type: "notification",
        at: n.sent_at as string,
        label: `Notification to ${name}`,
        sublabel: `Status: ${n.status}`,
      });
    }
    for (const r of recentRecoveries.data ?? []) {
      const name =
        (r as { customers?: { full_name?: string } | null }).customers?.full_name ?? "a customer";
      const productName =
        (r as { products?: { name?: string } | null }).products?.name ?? "a product";
      feed.push({
        id: `recov-${r.id}`,
        type: "recovery",
        at: r.recovered_at as string,
        label: `${name} bought ${productName}`,
        sublabel: `R ${((r.amount_cents ?? 0) / 100).toFixed(2)} recovered`,
      });
    }
    feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const recentActivity = feed.slice(0, 12);

    return {
      kpis: {
        todaysScans,
        todaysScansDelta,
        customersWaiting:
          (interestsActiveCount as unknown as { count?: number })?.count ?? 0,
        revenueRecoveredCents,
        currency,
        notificationsSent,
        notificationConversionPct,
        lowStockCount: lowStockProductsRaw.length,
        onPromotionCount,
        topProductName: topProducts[0]?.name ?? null,
        topProductInterestCount: topProducts[0]?.interestCount ?? 0,
      },
      scansDaily,
      scansWeekly,
      scansMonthly,
      customerGrowth,
      topProducts,
      lowStockProducts: lowStockProductsRaw.slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        stockQty: p.stock_qty,
        lowStockThreshold: p.low_stock_threshold,
      })),
      promotionProducts: promos.slice(0, 6).map((p) => ({
        id: p.id,
        name:
          (productById.get(p.product_id ?? "")?.name as string | undefined) ??
          p.name ??
          "Promotion",
        discountPct: Number(p.discount_pct ?? 0),
        endsAt: p.ends_at,
      })),
      notificationPerf,
      recentActivity,
      hasRetailerContext,
    };
  });

const TYPE_LABEL: Record<NotificationTypePerf["type"], string> = {
  back_in_stock: "Back in stock",
  sale: "Price drop",
  low_stock: "Low stock",
  promotion: "Promotion",
  custom: "Custom",
};

export const getNotificationTypePerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationTypePerf[]> => {
    const { supabase } = context;
    const { data: history } = await supabase
      .from("notification_history")
      .select("status, sent_at, delivered_at, read_at, clicked_at, redeemed_at, campaign:notification_campaigns(type)");

    const acc = new Map<NotificationTypePerf["type"], NotificationTypePerf>();
    (Object.keys(TYPE_LABEL) as NotificationTypePerf["type"][]).forEach((t) => {
      acc.set(t, {
        type: t,
        label: TYPE_LABEL[t],
        sent: 0,
        delivered: 0,
        read: 0,
        clicked: 0,
        redeemed: 0,
        ctr: 0,
      });
    });
    for (const row of history ?? []) {
      const t = ((row as any).campaign?.type ?? "custom") as NotificationTypePerf["type"];
      const bucket = acc.get(t) ?? acc.get("custom")!;
      if (row.sent_at) bucket.sent += 1;
      if (row.delivered_at) bucket.delivered += 1;
      if (row.read_at) bucket.read += 1;
      if (row.clicked_at) bucket.clicked += 1;
      if (row.redeemed_at) bucket.redeemed += 1;
    }
    const rows = Array.from(acc.values());
    for (const r of rows) {
      r.ctr = r.delivered ? Math.round((r.clicked / r.delivered) * 1000) / 10 : 0;
    }
    return rows;
  });

export const getInventoryNotificationCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("notification_history")
      .select("queued_at, sent_at, read_at, clicked_at");
    let queued = 0, sent = 0, read = 0, clicked = 0;
    for (const row of data ?? []) {
      if (row.queued_at) queued += 1;
      if (row.sent_at) sent += 1;
      if (row.read_at) read += 1;
      if (row.clicked_at) clicked += 1;
    }
    return { queued, sent, read, clicked };
  });

const SIGNAL_META: { key: SignalContribution["key"]; label: string; column: string }[] = [
  { key: "scans", label: "Scans", column: "scans_total" },
  { key: "repeat_scans", label: "Repeat scans", column: "repeat_scans" },
  { key: "time_on_page", label: "Time on page", column: "avg_time_on_page_seconds" },
  { key: "unique_viewers", label: "Unique viewers", column: "viewers" },
  { key: "watchlist", label: "Watchlist", column: "watchlist_adds" },
  { key: "notif_engagement", label: "Notif engagement", column: "notif_engagement" },
  { key: "conversion_rate", label: "Conversion rate", column: "conversion_rate" },
  { key: "cart_rate", label: "Cart rate", column: "add_to_cart_rate" },
  { key: "price_impact", label: "Price impact", column: "price_impact" },
];

export const getSignalContributions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: signals } = await supabase
      .from("product_intent_signals")
      .select(
        "product_id, scans_total, repeat_scans, avg_time_on_page_seconds, viewers, watchlist_adds, notif_engagement, conversion_rate, add_to_cart_rate, price_impact, product:products(name, image_url)",
      );
    const rows = (signals ?? []) as any[];

    // Total per signal column
    const totals = new Map<SignalContribution["key"], number>();
    for (const meta of SIGNAL_META) {
      let sum = 0;
      for (const r of rows) sum += Number(r[meta.column] ?? 0);
      totals.set(meta.key, sum);
    }
    const grand = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;

    const contributions: SignalContribution[] = SIGNAL_META.map((meta) => ({
      key: meta.key,
      label: meta.label,
      pct: Math.round(((totals.get(meta.key) ?? 0) / grand) * 1000) / 10,
    }));

    // Per-signal top products
    const breakdown: Record<SignalContribution["key"], SignalProductBreakdown[]> = {} as any;
    for (const meta of SIGNAL_META) {
      const totalForSignal = totals.get(meta.key) ?? 0;
      const list: SignalProductBreakdown[] = rows
        .map((r) => ({
          product_id: r.product_id as string,
          name: (r.product?.name as string) ?? "Unknown",
          image_url: (r.product?.image_url as string) ?? null,
          raw: Number(r[meta.column] ?? 0),
          contribution_pct: totalForSignal
            ? Math.round((Number(r[meta.column] ?? 0) / totalForSignal) * 1000) / 10
            : 0,
        }))
        .filter((p) => p.raw > 0)
        .sort((a, b) => b.raw - a.raw)
        .slice(0, 10);
      breakdown[meta.key] = list;
    }

    return { contributions, breakdown };
  });


// ─── Briefing (home page) ────────────────────────────────────────────────
export type BriefingProduct = {
  id: string;
  name: string;
  image_url: string | null;
  tagged_at: string;
  gtin: string | null;
};
export type BriefingBucket = { key: string; label: string; products: BriefingProduct[] };
export type BriefingUnread = {
  conversation_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
};
export type Briefing = {
  buckets: BriefingBucket[];
  unread: BriefingUnread[];
  totalTagged: number;
  greetingName: string | null;
};


export const getBriefing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Briefing> => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("retailer_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const retailerId = role?.retailer_id;
    if (!retailerId) return { buckets: [], unread: [], totalTagged: 0 };

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
    const { data: products = [] } = await supabase
      .from("products")
      .select("id, name, image_url, gtin, created_at")
      .eq("retailer_id", retailerId)
      .not("gtin", "is", null)
      .gte("created_at", startOfYear)
      .order("created_at", { ascending: false })
      .limit(500);

    // Bucket by This Week / Last Week / Month name.
    const startOfWeek = (d: Date) => {
      const c = new Date(d);
      const day = (c.getDay() + 6) % 7; // Monday = 0
      c.setHours(0, 0, 0, 0);
      c.setDate(c.getDate() - day);
      return c;
    };
    const thisWeek = startOfWeek(now).getTime();
    const lastWeek = thisWeek - 7 * 86400 * 1000;
    const monthLabels = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    const bucketMap = new Map<string, BriefingBucket>();
    const put = (key: string, label: string, p: BriefingProduct) => {
      if (!bucketMap.has(key)) bucketMap.set(key, { key, label, products: [] });
      bucketMap.get(key)!.products.push(p);
    };
    for (const p of products ?? []) {
      const ts = new Date(p.created_at).getTime();
      const proj: BriefingProduct = {
        id: p.id,
        name: p.name,
        image_url: p.image_url,
        gtin: p.gtin,
        tagged_at: p.created_at,
      };
      if (ts >= thisWeek) put("this-week", "This week", proj);
      else if (ts >= lastWeek) put("last-week", "Last week", proj);
      else {
        const d = new Date(p.created_at);
        const key = `m-${d.getMonth()}`;
        put(key, monthLabels[d.getMonth()], proj);
      }
    }
    // Order: this-week, last-week, then months desc.
    const buckets: BriefingBucket[] = [];
    if (bucketMap.has("this-week")) buckets.push(bucketMap.get("this-week")!);
    if (bucketMap.has("last-week")) buckets.push(bucketMap.get("last-week")!);
    for (let m = now.getMonth(); m >= 0; m--) {
      const k = `m-${m}`;
      if (bucketMap.has(k)) buckets.push(bucketMap.get(k)!);
    }

    const { data: convs = [] } = await supabase
      .from("conversations")
      .select(
        "id, customer_id, subject, last_message_at, unread_count, customers(full_name, whatsapp_e164)",
      )
      .eq("retailer_id", retailerId)
      .gt("unread_count", 0)
      .order("last_message_at", { ascending: false })
      .limit(20);

    const convIds = (convs ?? []).map((c: any) => c.id);
    let lastMsgByConv = new Map<string, string>();
    if (convIds.length > 0) {
      const { data: msgs = [] } = await supabase
        .from("conversation_messages")
        .select("conversation_id, body, sent_at")
        .in("conversation_id", convIds)
        .eq("direction", "inbound")
        .order("sent_at", { ascending: false })
        .limit(200);
      for (const m of msgs ?? []) {
        if (!lastMsgByConv.has(m.conversation_id)) {
          lastMsgByConv.set(m.conversation_id, m.body ?? "");
        }
      }
    }

    const unread: BriefingUnread[] = (convs ?? []).map((c: any) => ({
      conversation_id: c.id,
      customer_name: c.customers?.full_name ?? null,
      customer_phone: c.customers?.whatsapp_e164 ?? null,
      last_message: lastMsgByConv.get(c.id) ?? c.subject ?? null,
      last_message_at: c.last_message_at,
      unread_count: c.unread_count,
    }));

    return {
      buckets,
      unread,
      totalTagged: buckets.reduce((n, b) => n + b.products.length, 0),
    };
  });
