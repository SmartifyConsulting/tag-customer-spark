// Tag subscription plans — 5-tier base + overage model.
// ZAR = PayFast, USD = PayPal (self-serve). Enterprise = contact sales.
export type PlanId = "go" | "starter" | "growth" | "pro" | "enterprise";
export type Cycle = "monthly" | "annual";
export type AlertType = "sale" | "back_in_stock" | "new_arrival" | "low_stock" | "promotion" | "custom";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  ideal_candidate: string;
  monthly_zar_cents: number;
  annual_zar_cents: number;
  monthly_usd_cents: number;
  annual_usd_cents: number;
  included_notifications: number; // 0 for custom
  overage_cents_per_msg: number;  // ZAR cents
  max_products: number | null;    // null = unlimited
  max_stores: number | null;
  staff_seats: number | null;
  alert_types: AlertType[];
  inbox: "basic" | "full";
  features: string[];
  locked: string[];
  custom?: boolean;
}

const ALL_ALERTS: AlertType[] = ["sale", "back_in_stock", "new_arrival", "low_stock", "promotion", "custom"];

// Annual ≈ 10× monthly (17% off). USD ≈ ZAR ÷ 18 rounded.
export const PLANS: Record<PlanId, Plan> = {
  go: {
    id: "go",
    name: "Tag Go",
    tagline: "Mobile traders, flea market vendors, pop-up stalls",
    ideal_candidate: "Flea market vendor, pop-up trader, weekend market stall, home-based seller",
    monthly_zar_cents: 14900,
    annual_zar_cents: 149000,
    monthly_usd_cents: 900,
    annual_usd_cents: 9000,
    included_notifications: 50,
    overage_cents_per_msg: 150,
    max_products: 10,
    max_stores: 1,
    staff_seats: 1,
    alert_types: ["sale", "back_in_stock", "new_arrival"],
    inbox: "basic",
    features: [
      "50 notifications / month",
      "R1.50 per msg above 50",
      "Sale, back-in-stock, new arrival alerts",
      "Basic inbox — read & reply only",
      "1 stall / store · up to 10 products",
      "Store-level opt-in · QR tag generation",
      "Scan counts & active subscriber total",
      "1 user login",
    ],
    locked: ["Low-stock, promotion & custom alerts", "Intent scoring", "ROI engine", "AI intelligence", "Staff roles", "Multi-store"],
  },
  starter: {
    id: "starter",
    name: "Tag Starter",
    tagline: "Small independents finding their feet with Tag",
    ideal_candidate: "Small boutique, gift shop, independent shoe store",
    monthly_zar_cents: 39900,
    annual_zar_cents: 399000,
    monthly_usd_cents: 2200,
    annual_usd_cents: 22000,
    included_notifications: 150,
    overage_cents_per_msg: 140,
    max_products: 20,
    max_stores: 1,
    staff_seats: 2,
    alert_types: ALL_ALERTS,
    inbox: "full",
    features: [
      "150 notifications / month",
      "R1.40 per msg above 150",
      "All 6 alert types",
      "Full inbox — assign, note, resolve, tag",
      "Coupon code redemption",
      "1 store · up to 20 products · item + store-level opt-in",
      "Scan counts, opt-in history, campaign performance",
      "Basic customer list",
      "2 user logins · basic staff roles",
    ],
    locked: ["Intent scoring", "ROI engine", "AI intelligence", "Multi-store"],
  },
  growth: {
    id: "growth",
    name: "Tag Growth",
    tagline: "Established independents scaling their customer base",
    ideal_candidate: "Active boutique, homeware store, jewellery retailer, lifestyle brand with growing customer base",
    monthly_zar_cents: 69900,
    annual_zar_cents: 699000,
    monthly_usd_cents: 3900,
    annual_usd_cents: 39000,
    included_notifications: 300,
    overage_cents_per_msg: 130,
    max_products: 50,
    max_stores: 1,
    staff_seats: 3,
    alert_types: ALL_ALERTS,
    inbox: "full",
    features: [
      "300 notifications / month",
      "R1.30 per msg above 300",
      "All 6 alert types + coupon redemption",
      "Scheduled campaigns · AI message assist",
      "Full inbox — assign, note, resolve, tag",
      "1 store · up to 50 products · item + store-level opt-in",
      "Full campaign analytics · intent score engine",
      "Customer revenue tracking · watchlists",
      "3 user logins · full staff roles",
    ],
    locked: ["ROI engine", "AI daily briefing", "Forecasting", "Multi-store"],
  },
  pro: {
    id: "pro",
    name: "Tag Pro",
    tagline: "Serious independents and small multi-branch retailers",
    ideal_candidate: "High-volume independent, small chain with 2–3 branches, established boutique group",
    monthly_zar_cents: 129900,
    annual_zar_cents: 1299000,
    monthly_usd_cents: 7200,
    annual_usd_cents: 72000,
    included_notifications: 600,
    overage_cents_per_msg: 120,
    max_products: null,
    max_stores: 3,
    staff_seats: 10,
    alert_types: ALL_ALERTS,
    inbox: "full",
    features: [
      "600 notifications / month",
      "R1.20 per msg above 600",
      "All 6 alert types · scheduled campaigns · AI assist",
      "Up to 3 stores · unlimited products",
      "Full campaign analytics · intent score engine",
      "ROI engine · AI daily briefing · weekly ROI email",
      "Pricing sensitivity · scan heatmap",
      "Forecasting (7 + 14 day)",
      "10 user logins · full staff roles · multi-store (up to 3)",
    ],
    locked: ["Cross-store intelligence", "Executive briefing suite", "API access & SSO"],
  },
  enterprise: {
    id: "enterprise",
    name: "Tag Enterprise",
    tagline: "Regional chains and national retailers — priced per branch",
    ideal_candidate: "Regional chains (5+ branches), national retailers, franchise groups, shopping-centre operators",
    monthly_zar_cents: 0,
    annual_zar_cents: 0,
    monthly_usd_cents: 0,
    annual_usd_cents: 0,
    included_notifications: 0,
    overage_cents_per_msg: 0,
    max_products: null,
    max_stores: null,
    staff_seats: null,
    alert_types: ALL_ALERTS,
    inbox: "full",
    custom: true,
    features: [
      "Negotiated rate per branch",
      "Volume-based overage pricing",
      "All alert types · full WhatsApp inbox",
      "Coupon redemption · scheduled campaigns · AI assist",
      "Unlimited branches & products",
      "Everything in Pro + cross-store intelligence",
      "Cross-store transfer alerts",
      "Executive briefing suite · CFO-level ROI reporting",
      "Custom data exports · API access",
      "Unlimited users · dedicated account manager",
      "SLA uptime · staff training · white-label option",
    ],
    locked: [],
  },
};

export const SELF_SERVE_PLANS: PlanId[] = ["starter", "growth", "pro"];

export function priceCents(plan: PlanId, cycle: Cycle, currency: "ZAR" | "USD"): number {
  const p = PLANS[plan];
  if (currency === "ZAR") return cycle === "annual" ? p.annual_zar_cents : p.monthly_zar_cents;
  return cycle === "annual" ? p.annual_usd_cents : p.monthly_usd_cents;
}

export function periodEnd(cycle: Cycle, from = new Date()): Date {
  const d = new Date(from);
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function formatZar(cents: number): string {
  if (cents === 0) return "Custom";
  return `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
export function formatUsd(cents: number): string {
  if (cents === 0) return "Custom";
  return `$${(cents / 100).toFixed(0)}`;
}
