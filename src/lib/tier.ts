// Shared tier definitions. Client-safe: no server-only imports.

export type TagTier = "go" | "starter" | "growth" | "pro" | "enterprise";

export type TierFeatureKey =
  | "intelligence"
  | "roi"
  | "aiAssistant"
  | "weeklyBriefings"
  | "intentEngine"
  | "bulkQr"
  | "advancedExports"
  | "apiAccess"
  | "multiStore"
  | "opportunityFeed";

export const TIER_LABEL: Record<TagTier, string> = {
  go: "Tag Go",
  starter: "Tag Starter",
  growth: "Tag Growth",
  pro: "Tag Pro",
  enterprise: "Tag Enterprise",
};

// Which tier unlocks each feature under the new 5-tier model.
export const FEATURE_MIN_TIER: Record<TierFeatureKey, TagTier> = {
  bulkQr: "starter",
  advancedExports: "starter",
  aiAssistant: "growth",
  intentEngine: "growth",
  multiStore: "pro",
  roi: "pro",
  weeklyBriefings: "pro",
  opportunityFeed: "pro",
  intelligence: "enterprise",
  apiAccess: "enterprise",
};

const RANK: Record<TagTier, number> = { go: 0, starter: 1, growth: 2, pro: 3, enterprise: 4 };

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
      "Cross-store intelligence, executive briefings, custom data exports — surfaced automatically.",
  },
  roi: {
    title: "Performance & ROI",
    description:
      "Attribute recovered revenue to campaigns, run pricing sensitivity and conversion funnels.",
  },
  weeklyBriefings: {
    title: "Weekly ROI email report",
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
  opportunityFeed: {
    title: "AI Opportunity Feed",
    description:
      "Daily AI-surfaced actions ranked by projected revenue — available on Tag Pro and above.",
  },
};
