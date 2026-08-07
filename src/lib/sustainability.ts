// Client-safe sustainability types, defaults and query options.
// All environmental maths lives server-side in sustainability.functions.ts,
// but the factor shape and labels are shared so the config UI and the
// info tooltips stay in sync with the calculations.
import { queryOptions } from "@tanstack/react-query";
import {
  getSustainabilityOverview,
  getSustainabilitySettings,
  getSustainabilityInsights,
} from "./sustainability.functions";

export type SustainabilityPeriodKey =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "since"
  | "custom";

export const SUSTAINABILITY_PERIODS: { key: SustainabilityPeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
  { key: "since", label: "Since Joining TAG" },
  { key: "custom", label: "Custom Range" },
];

export type SustainabilitySettings = {
  retailer_id: string;
  enabled: boolean;
  demo_mode: boolean;
  avg_receipt_length_cm: number;
  avg_receipt_weight_g: number;
  cost_per_receipt_cents: number;
  printer_maintenance_cents_per_1000: number;
  ink_cents_per_1000: number;
  electricity_cents_per_kwh: number;
  energy_kwh_per_1000_receipts: number;
  co2_kg_per_kg_paper: number;
  water_l_per_kg_paper: number;
  currency: string;
  units: string;
};

export const SUSTAINABILITY_DEFAULTS: Omit<SustainabilitySettings, "retailer_id"> = {
  enabled: true,
  demo_mode: false,
  avg_receipt_length_cm: 20,
  avg_receipt_weight_g: 3.5,
  cost_per_receipt_cents: 12,
  printer_maintenance_cents_per_1000: 3500,
  ink_cents_per_1000: 1500,
  electricity_cents_per_kwh: 280,
  energy_kwh_per_1000_receipts: 1.2,
  co2_kg_per_kg_paper: 2.4,
  water_l_per_kg_paper: 22,
  currency: "ZAR",
  units: "metric",
};

// Field metadata drives the admin config form and the "how is this worked
// out?" info popovers on each KPI card.
export const FACTOR_FIELDS: {
  key: keyof Omit<SustainabilitySettings, "retailer_id" | "enabled" | "demo_mode" | "currency" | "units">;
  label: string;
  suffix: string;
  step?: number;
  help: string;
}[] = [
  { key: "avg_receipt_length_cm", label: "Average receipt length", suffix: "cm", step: 0.5, help: "Typical printed till slip length. Drives metres of receipt roll avoided." },
  { key: "avg_receipt_weight_g", label: "Average receipt weight", suffix: "g", step: 0.1, help: "Typical thermal slip weight. Drives kilograms of thermal paper saved." },
  { key: "cost_per_receipt_cents", label: "Cost per receipt", suffix: "cents", step: 1, help: "Paper cost of printing one till slip." },
  { key: "printer_maintenance_cents_per_1000", label: "Printer maintenance", suffix: "cents / 1 000 receipts", step: 100, help: "Servicing, head replacement and downtime per thousand printed slips." },
  { key: "ink_cents_per_1000", label: "Ink / ribbon", suffix: "cents / 1 000 receipts", step: 100, help: "Ribbon or ink consumable cost per thousand printed slips. Zero for pure thermal printers." },
  { key: "electricity_cents_per_kwh", label: "Electricity cost", suffix: "cents / kWh", step: 10, help: "Tariff used to price the energy avoided." },
  { key: "energy_kwh_per_1000_receipts", label: "Printer energy", suffix: "kWh / 1 000 receipts", step: 0.1, help: "Energy a till printer draws per thousand slips." },
  { key: "co2_kg_per_kg_paper", label: "Carbon factor", suffix: "kg CO₂e / kg paper", step: 0.1, help: "Cradle-to-gate emissions of thermal paper production." },
  { key: "water_l_per_kg_paper", label: "Water factor", suffix: "litres / kg paper", step: 1, help: "Process water used to manufacture a kilogram of thermal paper." },
];

export type SustainabilityStoreRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  transactions: number;
  digitalReceipts: number;
  adoptionPct: number;
  paperSavedKg: number;
  co2Kg: number;
  score: number;
  band: "high" | "medium" | "low";
};

export type SustainabilityOverview = {
  hasRetailerContext: boolean;
  demo: boolean;
  currency: string;
  joinedAt: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  live: { digitalReceipts: number; paperAvoided: number; thermalPaperKg: number };
  receipts: {
    total: number;
    digitalSharePct: number;
    dailyAverage: number;
    growthPct: number;
    previousTotal: number;
  };
  paper: { receiptsAvoided: number; metres: number; kilograms: number };
  environment: { co2Kg: number; waterLitres: number; energyKwh: number };
  cost: {
    paperCents: number;
    maintenanceCents: number;
    inkCents: number;
    energyCents: number;
    totalCents: number;
    annualisedCents: number;
  };
  adoptionSeries: { date: string; digital: number; paper: number }[];
  monthlyImpact: { month: string; paperKg: number; co2Kg: number; waterL: number }[];
  stores: SustainabilityStoreRow[];
  funnel: { stage: string; value: number }[];
  consumers: {
    participating: number;
    avgReceiptsPerCustomer: number;
    autoWalletPct: number;
    avgPaperSavedGrams: number;
  };
  leaderboards: {
    stores: { name: string; value: number; unit: string }[];
    cashiers: { name: string; value: number; unit: string }[];
    regions: { name: string; value: number; unit: string }[];
    adoption: { name: string; value: number; unit: string }[];
    paper: { name: string; value: number; unit: string }[];
  };
};

export function sustainabilityOverviewQueryOptions(input: {
  period: SustainabilityPeriodKey;
  from?: string;
  to?: string;
}) {
  return queryOptions({
    queryKey: ["sustainability", "overview", input],
    queryFn: () => getSustainabilityOverview({ data: input }),
    staleTime: 30_000,
  });
}

export const sustainabilitySettingsQueryOptions = queryOptions({
  queryKey: ["sustainability", "settings"],
  queryFn: () => getSustainabilitySettings(),
  staleTime: 5 * 60_000,
});

export function sustainabilityInsightsQueryOptions(input: {
  period: SustainabilityPeriodKey;
  from?: string;
  to?: string;
}) {
  return queryOptions({
    queryKey: ["sustainability", "insights", input],
    queryFn: () => getSustainabilityInsights({ data: input }),
    staleTime: 10 * 60_000,
  });
}

export function bandColour(band: "high" | "medium" | "low") {
  return band === "high"
    ? "bg-emerald-500"
    : band === "medium"
      ? "bg-amber-500"
      : "bg-rose-500";
}

export function formatKg(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t`;
  return `${kg.toLocaleString(undefined, { maximumFractionDigits: kg < 10 ? 2 : 0 })} kg`;
}

export function formatLitres(l: number) {
  if (l >= 1000) return `${(l / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kL`;
  return `${l.toLocaleString(undefined, { maximumFractionDigits: 0 })} L`;
}

export function formatMetres(m: number) {
  if (m >= 1000) return `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
  return `${m.toLocaleString(undefined, { maximumFractionDigits: 0 })} m`;
}
