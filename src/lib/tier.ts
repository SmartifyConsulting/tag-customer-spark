// Shared tier definitions. Client-safe: no server-only imports.

export type TagTier = "starter" | "pro" | "enterprise";

export type TierFeatureKey =
  | "intelligence"
  | "roi"
  | "aiAssistant"
  | "weeklyBriefings"
  | "intentEngine"
  | "bulkQr"
  | "advancedExports"
  | "apiAccess"
  | "multiStore";

export const TIER_LABEL: Record<TagTier, string> = {
  starter: "Tag Starter",
  pro: "Tag Pro",
  enterprise: "Tag Enterprise",
};

// Which tier unlocks each feature (starter=all, pro=pro+enterprise, enterprise-only)
export const FEATURE_MIN_TIER: Record<TierFeatureKey, TagTier> = {
  bulkQr: "pro",
  aiAssistant: "pro",
  advancedExports: "pro",
  multiStore: "pro",
  intelligence: "enterprise",
  roi: "enterprise",
  weeklyBriefings: "enterprise",
  intentEngine: "enterprise",
  apiAccess: "enterprise",
};

const RANK: Record<TagTier, number> = { starter: 0, pro: 1, enterprise: 2 };

export function hasFeature(tier: TagTier | undefined, feature: TierFeatureKey): boolean {
  if (!tier) return false;
  return RANK[tier] >= RANK[FEATURE_MIN_TIER[feature]];
}

export function meetsTier(tier: TagTier | undefined, min: TagTier): boolean {
  if (!tier) return false;
  return RANK[tier] >= RANK[min];
}

// Human-readable feature descriptions used on the upgrade page.
export const FEATURE_META: Record<
  TierFeatureKey,
  { title: string; description: string }
> = {
  intelligence: {
    title: "Intelligence suite",
    description:
      "Opportunity feed, demand insights, forecasting and trend detection — surfaced automatically.",
  },
  roi: {
    title: "Performance & ROI",
    description:
      "Attribute recovered revenue to campaigns, run pricing sensitivity and conversion funnels.",
  },
  weeklyBriefings: {
    title: "Weekly AI briefings",
    description:
      "Every Monday, a written executive summary of wins, watch-outs and next-week actions.",
  },
  intentEngine: {
    title: "Intent score engine",
    description: "Per-product 0–100 intent scores with retailer-tunable weights.",
  },
  aiAssistant: {
    title: "AI campaign assistant",
    description: "Draft, rewrite and predict campaign response before you press send.",
  },
  bulkQr: {
    title: "Bulk QR & PDF export",
    description: "Generate hundreds of QR cards at once and print them on A4.",
  },
  advancedExports: {
    title: "CSV & XLSX exports",
    description: "Export any report to spreadsheet formats your finance team already uses.",
  },
  apiAccess: {
    title: "API access, SSO & audit log export",
    description:
      "Integrate Tag with your existing stack and satisfy enterprise governance requirements.",
  },
  multiStore: {
    title: "Multi-store management",
    description: "Run every branch from one Tag workspace.",
  },
};
