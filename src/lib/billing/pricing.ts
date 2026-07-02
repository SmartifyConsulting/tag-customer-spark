// Tag subscription plans. ZAR for PayFast, USD for PayPal.
export type PlanId = "starter" | "pro" | "enterprise";
export type Cycle = "monthly" | "annual";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthly_zar_cents: number;
  annual_zar_cents: number;
  monthly_usd_cents: number;
  annual_usd_cents: number;
  features: string[];
  cta?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Free forever · single store",
    monthly_zar_cents: 0,
    annual_zar_cents: 0,
    monthly_usd_cents: 0,
    annual_usd_cents: 0,
    features: [
      "Up to 25 products with QR tags",
      "WhatsApp opt-in landing pages",
      "Basic scan analytics",
      "1 store · 2 seats",
    ],
    cta: "Current",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Multi-store · scale customer recovery",
    monthly_zar_cents: 49900,
    annual_zar_cents: 499000,
    monthly_usd_cents: 2900,
    annual_usd_cents: 29000,
    features: [
      "Unlimited products & QR tags",
      "Bulk QR generation + A4 print",
      "AI campaign copy assist",
      "Multi-store rollups",
      "Watchlists & advanced analytics",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Retail Intelligence & ROI at chain scale",
    monthly_zar_cents: 249900,
    annual_zar_cents: 2499000,
    monthly_usd_cents: 13900,
    annual_usd_cents: 139000,
    features: [
      "Everything in Pro",
      "AI Intelligence & Opportunity Feeds",
      "Weekly AI briefings & executive summary",
      "ROI Engine with attribution",
      "SSO, audit exports, priority support",
    ],
  },
};

export function priceCents(plan: PlanId, cycle: Cycle, currency: "ZAR" | "USD"): number {
  const p = PLANS[plan];
  if (currency === "ZAR") {
    return cycle === "annual" ? p.annual_zar_cents : p.monthly_zar_cents;
  }
  return cycle === "annual" ? p.annual_usd_cents : p.monthly_usd_cents;
}

export function periodEnd(cycle: Cycle, from = new Date()): Date {
  const d = new Date(from);
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function formatZar(cents: number): string {
  if (cents === 0) return "Free";
  return `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
export function formatUsd(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}
