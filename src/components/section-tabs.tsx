import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useMemo } from "react";
import { useTier } from "@/hooks/use-tier";
import { hasFeature, type TierFeatureKey } from "@/lib/tier";

export type SectionTab = {
  label: string;
  to: string;
  match: string[];
  // When set, tab is gated behind this feature.
  feature?: TierFeatureKey;
};
export type SectionDef = {
  key: string;
  label: string;
  rootPath: string;
  tabs: SectionTab[];
  // When set, the whole section is gated (nav still shows it as locked).
  feature?: TierFeatureKey;
};

export const SECTIONS: SectionDef[] = [
  {
    key: "workspace",
    label: "Dashboard",
    rootPath: "/dashboard",
    tabs: [
      { label: "Dashboard", to: "/dashboard", match: ["/dashboard"] },
      { label: "Alerts", to: "/alerts", match: ["/alerts", "/inbox", "/notifications"] },
    ],
  },
  {
    key: "engagement",
    label: "Engagement",
    rootPath: "/customers",
    tabs: [
      { label: "Customers", to: "/customers", match: ["/customers"] },
      { label: "Products", to: "/products", match: ["/products"] },
      { label: "Stock", to: "/stock", match: ["/stock"] },
      { label: "QR Tags", to: "/qr-tags", match: ["/qr-tags"] },
      { label: "Watchlists", to: "/watchlists", match: ["/watchlists"] },
      { label: "Compare", to: "/products/compare", match: ["/products/compare"] },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    rootPath: "/intelligence",
    feature: "intelligence",
    tabs: [
      { label: "Overview", to: "/intelligence", match: ["/intelligence"], feature: "intelligence" },
      { label: "Intent Engine", to: "/intent", match: ["/intent"], feature: "intentEngine" },
      { label: "Demand Insights", to: "/intelligence/insights", match: ["/intelligence/insights"], feature: "intelligence" },
      { label: "Forecasting", to: "/intelligence/forecasting", match: ["/intelligence/forecasting"], feature: "intelligence" },
      { label: "Trend Detection", to: "/intelligence/trends", match: ["/intelligence/trends"], feature: "intelligence" },
    ],
  },
  {
    key: "performance",
    label: "Performance & ROI",
    rootPath: "/roi",
    feature: "roi",
    tabs: [
      { label: "ROI Engine", to: "/roi", match: ["/roi"], feature: "roi" },
      { label: "Pricing Sensitivity", to: "/commerce/pricing", match: ["/commerce/pricing"], feature: "roi" },
      { label: "Conversion Funnel", to: "/commerce/funnel", match: ["/commerce/funnel"], feature: "roi" },
      { label: "Executive Reports", to: "/analytics", match: ["/analytics", "/analytics/reports"], feature: "roi" },
      { label: "Historical Trends", to: "/analytics/history", match: ["/analytics/history"], feature: "roi" },
    ],
  },
  {
    key: "management",
    label: "Management",
    rootPath: "/stores",
    tabs: [
      { label: "Stores", to: "/stores", match: ["/stores"] },
      { label: "Staff", to: "/staff", match: ["/staff"] },
      { label: "Permissions", to: "/organisation/roles", match: ["/organisation/roles"] },
      { label: "Settings", to: "/settings", match: ["/settings"] },
    ],
  },
];

function bestMatch(pathname: string, candidates: string[]): number {
  let best = -1;
  for (const c of candidates) {
    if (pathname === c || pathname.startsWith(c + "/")) {
      if (c.length > best) best = c.length;
    }
  }
  return best;
}

export function findActiveSection(pathname: string): SectionDef | null {
  let winner: { section: SectionDef; score: number } | null = null;
  for (const s of SECTIONS) {
    for (const t of s.tabs) {
      const m = bestMatch(pathname, t.match);
      if (m > (winner?.score ?? -1)) winner = { section: s, score: m };
    }
  }
  return winner?.section ?? null;
}

export function findActiveTab(section: SectionDef, pathname: string): SectionTab | null {
  let winner: { tab: SectionTab; score: number } | null = null;
  for (const t of section.tabs) {
    const m = bestMatch(pathname, t.match);
    if (m > (winner?.score ?? -1)) winner = { tab: t, score: m };
  }
  return winner?.tab ?? null;
}

export function SectionTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { tier } = useTier();
  const section = useMemo(() => findActiveSection(pathname), [pathname]);
  const activeTab = useMemo(
    () => (section ? findActiveTab(section, pathname) : null),
    [section, pathname],
  );

  if (!section) return null;

  return (
    <div className="sticky top-16 z-[5] -mx-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
      <div className="mx-auto flex w-fit items-center gap-0.5 overflow-x-auto rounded-full bg-foreground p-0.5">
        {section.tabs.map((t) => {
          const isActive = activeTab?.to === t.to;
          const locked = t.feature ? !hasFeature(tier, t.feature) : false;
          const base =
            "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5";
          if (locked) {
            return (
              <Link
                key={t.to}
                to="/upgrade"
                search={{ feature: t.feature }}
                className={`${base} text-white/60 hover:text-white`}
                title={`${t.label} is a paid feature`}
              >
                <Lock className="h-3.5 w-3.5" />
                {t.label}
              </Link>
            );
          }
          return (
            <Link
              key={t.to}
              to={t.to}
              className={[
                base,
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-white/80 hover:text-white",
              ].join(" ")}

            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
