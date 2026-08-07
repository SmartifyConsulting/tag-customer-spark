// Server-only sustainability computation. Everything that turns raw
// receipts/purchases into ESG numbers lives here so the *.functions.ts
// wrapper stays thin (server-fn splitting deletes runtime siblings).
import { SUSTAINABILITY_DEFAULTS } from "./sustainability";
import type {
  SustainabilityOverview,
  SustainabilityPeriodKey,
  SustainabilitySettings,
  SustainabilityStoreRow,
} from "./sustainability";

export async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

export async function loadSettings(
  supabase: any,
  retailerId: string,
): Promise<SustainabilitySettings> {
  const { data } = await supabase
    .from("sustainability_settings")
    .select("*")
    .eq("retailer_id", retailerId)
    .maybeSingle();
  if (data) return data as SustainabilitySettings;
  return { retailer_id: retailerId, ...SUSTAINABILITY_DEFAULTS };
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function resolveRange(
  period: SustainabilityPeriodKey,
  joinedAt: string,
  from?: string,
  to?: string,
) {
  const now = new Date();
  const end = now;
  let start: Date;
  switch (period) {
    case "today":
      start = startOfDay(now);
      break;
    case "week": {
      const d = startOfDay(now);
      const day = (d.getDay() + 6) % 7; // Monday-first
      d.setDate(d.getDate() - day);
      start = d;
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter":
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      start = from ? new Date(from) : new Date(joinedAt);
      return { start, end: to ? new Date(to) : end };
    case "since":
    default:
      start = new Date(joinedAt);
  }
  return { start, end };
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function periodLabel(period: SustainabilityPeriodKey, start: Date, end: Date) {
  if (period === "since") return `${DATE_FMT.format(start)} – Present`;
  if (period === "today") return DATE_FMT.format(start);
  return `${DATE_FMT.format(start)} – ${DATE_FMT.format(end)}`;
}

type Row = { at: string; storeId: string | null; digital: boolean; cashier: string | null };

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

// ── Demo dataset ────────────────────────────────────────────────────────
// Deterministic synthetic transactions so the dashboard can be demonstrated
// at retail-group scale. Always surfaced behind the "Demo data" badge and
// never mixed with live numbers.
function seeded(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function demoRows(start: Date, end: Date, stores: { id: string; name: string }[]): Row[] {
  const rows: Row[] = [];
  const list = stores.length
    ? stores
    : Array.from({ length: 8 }, (_, i) => ({ id: `demo-${i}`, name: `Demo Store ${i + 1}` }));
  const days = Math.max(1, Math.min(730, Math.round((+end - +start) / 86400000)));
  const cashiers = ["T. Nkosi", "A. Petersen", "M. Dlamini", "S. Naidoo", "K. Botha", "L. Mokoena"];
  for (let d = 0; d < days; d++) {
    const date = new Date(+start + d * 86400000);
    const ramp = 0.45 + (0.5 * d) / days; // adoption climbs over time
    list.forEach((store, si) => {
      const volume = 40 + Math.floor(seeded(d * 31 + si) * 90);
      for (let t = 0; t < volume; t++) {
        const r = seeded(d * 977 + si * 131 + t);
        const digital = r < ramp * (0.7 + 0.5 * seeded(si + 7));
        rows.push({
          at: new Date(+date + t * 60000).toISOString(),
          storeId: store.id,
          digital,
          cashier: cashiers[(si + t) % cashiers.length],
        });
      }
    });
  }
  return rows;
}

export async function buildOverview(
  supabase: any,
  userId: string,
  input: { period: SustainabilityPeriodKey; from?: string; to?: string },
): Promise<SustainabilityOverview> {
  const retailerId = await resolveRetailerId(supabase, userId);
  if (!retailerId) return emptyOverview(input.period);

  const [{ data: retailer }, settings, { data: storeRows }] = await Promise.all([
    supabase.from("retailers").select("created_at, currency").eq("id", retailerId).maybeSingle(),
    loadSettings(supabase, retailerId),
    supabase.from("stores").select("id, name, city, province").eq("retailer_id", retailerId),
  ]);

  const joinedAt = retailer?.created_at ?? new Date().toISOString();
  const { start, end } = resolveRange(input.period, joinedAt, input.from, input.to);
  const stores = (storeRows ?? []) as { id: string; name: string; city: string | null; province: string | null }[];
  const demo = !!settings.demo_mode;

  let rows: Row[] = [];
  let prevTotal = 0;
  let customerCount = 0;
  let tagCount = 0;
  let allTimeDigital = 0;

  if (demo) {
    rows = demoRows(start, end, stores);
    const span = +end - +start;
    prevTotal = Math.round(rows.filter((r) => r.digital).length * 0.86);
    customerCount = 12_400;
    tagCount = 7_930;
    allTimeDigital =
      rows.filter((r) => r.digital).length +
      Math.round(span / 86400000) * 120;
  } else {
    const [purchases, receipts, prev, customers, tags] = await Promise.all([
      supabase
        .from("purchases")
        .select("id, store_id, purchased_at, created_by")
        .eq("retailer_id", retailerId)
        .gte("purchased_at", start.toISOString())
        .lte("purchased_at", end.toISOString()),
      supabase
        .from("receipts")
        .select("id, purchase_id, issued_at")
        .eq("retailer_id", retailerId)
        .gte("issued_at", start.toISOString())
        .lte("issued_at", end.toISOString()),
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("retailer_id", retailerId)
        .gte("issued_at", new Date(+start - (+end - +start)).toISOString())
        .lt("issued_at", start.toISOString()),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("retailer_id", retailerId),
      supabase
        .from("consumer_tag_ids")
        .select("id", { count: "exact", head: true })
        .eq("retailer_id", retailerId),
    ]);

    const digitalIds = new Set((receipts.data ?? []).map((r: any) => r.purchase_id));
    rows = ((purchases.data ?? []) as any[]).map((p) => ({
      at: p.purchased_at,
      storeId: p.store_id,
      digital: digitalIds.has(p.id),
      cashier: p.created_by ?? null,
    }));
    // Receipts without a matching purchase in range still count as digital.
    for (const r of (receipts.data ?? []) as any[]) {
      if (!r.purchase_id) rows.push({ at: r.issued_at, storeId: null, digital: true, cashier: null });
    }
    prevTotal = prev.count ?? 0;
    customerCount = customers.count ?? 0;
    tagCount = tags.count ?? 0;
    const { count: allTime } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailerId);
    allTimeDigital = allTime ?? 0;
  }

  const digitalRows = rows.filter((r) => r.digital);
  const total = digitalRows.length;
  const transactions = rows.length;
  const days = Math.max(1, Math.round((+end - +start) / 86400000));

  const kgPerReceipt = settings.avg_receipt_weight_g / 1000;
  const kilograms = total * kgPerReceipt;
  const metres = (total * settings.avg_receipt_length_cm) / 100;
  const co2Kg = kilograms * settings.co2_kg_per_kg_paper;
  const waterLitres = kilograms * settings.water_l_per_kg_paper;
  const energyKwh = (total / 1000) * settings.energy_kwh_per_1000_receipts;

  const paperCents = total * settings.cost_per_receipt_cents;
  const maintenanceCents = (total / 1000) * settings.printer_maintenance_cents_per_1000;
  const inkCents = (total / 1000) * settings.ink_cents_per_1000;
  const energyCents = energyKwh * settings.electricity_cents_per_kwh;
  const totalCents = paperCents + maintenanceCents + inkCents + energyCents;

  // Series
  const byDay = new Map<string, { digital: number; paper: number }>();
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const dk = dayKey(r.at);
    const e = byDay.get(dk) ?? { digital: 0, paper: 0 };
    if (r.digital) e.digital++;
    else e.paper++;
    byDay.set(dk, e);
    if (r.digital) byMonth.set(monthKey(r.at), (byMonth.get(monthKey(r.at)) ?? 0) + 1);
  }
  const adoptionSeries = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-120)
    .map(([date, v]) => ({ date, digital: v.digital, paper: v.paper }));
  const monthlyImpact = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({
      month,
      paperKg: +(count * kgPerReceipt).toFixed(2),
      co2Kg: +(count * kgPerReceipt * settings.co2_kg_per_kg_paper).toFixed(2),
      waterL: +(count * kgPerReceipt * settings.water_l_per_kg_paper).toFixed(0),
    }));

  // Store comparison
  const storeAgg = new Map<string, { t: number; d: number }>();
  for (const r of rows) {
    const key = r.storeId ?? "unassigned";
    const e = storeAgg.get(key) ?? { t: 0, d: 0 };
    e.t++;
    if (r.digital) e.d++;
    storeAgg.set(key, e);
  }
  const nameOf = new Map(stores.map((s) => [s.id, s]));
  const storeList: SustainabilityStoreRow[] = [...storeAgg.entries()].map(([id, v]) => {
    const meta = nameOf.get(id);
    const adoptionPct = v.t ? (v.d / v.t) * 100 : 0;
    const paperSavedKg = v.d * kgPerReceipt;
    return {
      id,
      name: meta?.name ?? (id === "unassigned" ? "Unassigned" : id),
      city: meta?.city ?? null,
      province: meta?.province ?? null,
      transactions: v.t,
      digitalReceipts: v.d,
      adoptionPct: +adoptionPct.toFixed(1),
      paperSavedKg: +paperSavedKg.toFixed(2),
      co2Kg: +(paperSavedKg * settings.co2_kg_per_kg_paper).toFixed(2),
      score: Math.round(adoptionPct * 0.8 + Math.min(20, v.d / 50)),
      band: adoptionPct >= 70 ? "high" : adoptionPct >= 40 ? "medium" : "low",
    };
  });
  storeList.sort((a, b) => b.adoptionPct - a.adoptionPct);

  // Funnel
  const offered = Math.round(transactions * (demo ? 0.94 : 1));
  const walletActivated = demo ? Math.round(tagCount * 0.82) : tagCount;
  const funnel = [
    { stage: "Transactions", value: transactions },
    { stage: "Digital receipt offered", value: offered },
    { stage: "Digital receipt accepted", value: total },
    { stage: "TAG installed", value: demo ? Math.round(customerCount * 0.71) : customerCount },
    { stage: "Wallet activated", value: walletActivated },
    { stage: "Automatic receipts enabled", value: Math.round(walletActivated * (demo ? 0.78 : 0.6)) },
  ];

  // Cashier / region leaderboards
  const cashierAgg = new Map<string, number>();
  for (const r of digitalRows) if (r.cashier) cashierAgg.set(r.cashier, (cashierAgg.get(r.cashier) ?? 0) + 1);
  const regionAgg = new Map<string, number>();
  for (const s of storeList) {
    const region = s.province ?? s.city ?? "Unassigned";
    regionAgg.set(region, (regionAgg.get(region) ?? 0) + s.digitalReceipts);
  }
  const top = (m: Map<string, number>, unit: string) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value, unit }));

  return {
    hasRetailerContext: true,
    demo,
    currency: settings.currency || retailer?.currency || "ZAR",
    joinedAt,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    periodLabel: periodLabel(input.period, start, end),
    live: {
      digitalReceipts: allTimeDigital,
      paperAvoided: allTimeDigital,
      thermalPaperKg: +(allTimeDigital * kgPerReceipt).toFixed(2),
    },
    receipts: {
      total,
      digitalSharePct: transactions ? +((total / transactions) * 100).toFixed(1) : 0,
      dailyAverage: +(total / days).toFixed(1),
      growthPct: prevTotal ? +(((total - prevTotal) / prevTotal) * 100).toFixed(1) : 0,
      previousTotal: prevTotal,
    },
    paper: {
      receiptsAvoided: total,
      metres: +metres.toFixed(1),
      kilograms: +kilograms.toFixed(2),
    },
    environment: {
      co2Kg: +co2Kg.toFixed(2),
      waterLitres: +waterLitres.toFixed(0),
      energyKwh: +energyKwh.toFixed(2),
    },
    cost: {
      paperCents: Math.round(paperCents),
      maintenanceCents: Math.round(maintenanceCents),
      inkCents: Math.round(inkCents),
      energyCents: Math.round(energyCents),
      totalCents: Math.round(totalCents),
      annualisedCents: Math.round((totalCents / days) * 365),
    },
    adoptionSeries,
    monthlyImpact,
    stores: storeList,
    funnel,
    consumers: {
      participating: customerCount,
      avgReceiptsPerCustomer: customerCount ? +(allTimeDigital / customerCount).toFixed(1) : 0,
      autoWalletPct: customerCount ? +((tagCount / customerCount) * 100).toFixed(1) : 0,
      avgPaperSavedGrams: customerCount
        ? +((allTimeDigital * settings.avg_receipt_weight_g) / customerCount).toFixed(1)
        : 0,
    },
    leaderboards: {
      stores: storeList.slice(0, 5).map((s) => ({ name: s.name, value: s.digitalReceipts, unit: "receipts" })),
      cashiers: top(cashierAgg, "receipts"),
      regions: top(regionAgg, "receipts"),
      adoption: storeList.slice(0, 5).map((s) => ({ name: s.name, value: s.adoptionPct, unit: "%" })),
      paper: [...storeList]
        .sort((a, b) => b.paperSavedKg - a.paperSavedKg)
        .slice(0, 5)
        .map((s) => ({ name: s.name, value: s.paperSavedKg, unit: "kg" })),
    },
  };
}

export function emptyOverview(period: SustainabilityPeriodKey): SustainabilityOverview {
  const now = new Date().toISOString();
  return {
    hasRetailerContext: false,
    demo: false,
    currency: "ZAR",
    joinedAt: now,
    periodStart: now,
    periodEnd: now,
    periodLabel: "—",
    live: { digitalReceipts: 0, paperAvoided: 0, thermalPaperKg: 0 },
    receipts: { total: 0, digitalSharePct: 0, dailyAverage: 0, growthPct: 0, previousTotal: 0 },
    paper: { receiptsAvoided: 0, metres: 0, kilograms: 0 },
    environment: { co2Kg: 0, waterLitres: 0, energyKwh: 0 },
    cost: { paperCents: 0, maintenanceCents: 0, inkCents: 0, energyCents: 0, totalCents: 0, annualisedCents: 0 },
    adoptionSeries: [],
    monthlyImpact: [],
    stores: [],
    funnel: [],
    consumers: { participating: 0, avgReceiptsPerCustomer: 0, autoWalletPct: 0, avgPaperSavedGrams: 0 },
    leaderboards: { stores: [], cashiers: [], regions: [], adoption: [], paper: [] },
    // period retained for callers that echo it back
    ...(period ? {} : {}),
  };
}
