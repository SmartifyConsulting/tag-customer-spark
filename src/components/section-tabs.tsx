import { Link, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";

export type SectionTab = { label: string; to: string; match: string[] };
export type SectionDef = {
  key: string;
  label: string;
  rootPath: string;
  tabs: SectionTab[];
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
      { label: "QR Tags & Catalogue", to: "/products", match: ["/products", "/qr-tags"] },
      { label: "Watchlists", to: "/watchlists", match: ["/watchlists"] },
      { label: "Compare", to: "/products/compare", match: ["/products/compare"] },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    rootPath: "/intelligence",
    tabs: [
      { label: "Overview", to: "/intelligence", match: ["/intelligence"] },
      { label: "Intent Engine", to: "/intent", match: ["/intent"] },
      { label: "Demand Insights", to: "/intelligence/insights", match: ["/intelligence/insights"] },
      { label: "Forecasting", to: "/intelligence/forecasting", match: ["/intelligence/forecasting"] },
      { label: "Trend Detection", to: "/intelligence/trends", match: ["/intelligence/trends"] },
    ],
  },
  {
    key: "performance",
    label: "Performance & ROI",
    rootPath: "/roi",
    tabs: [
      { label: "ROI Engine", to: "/roi", match: ["/roi"] },
      { label: "Pricing Sensitivity", to: "/commerce/pricing", match: ["/commerce/pricing"] },
      { label: "Conversion Funnel", to: "/commerce/funnel", match: ["/commerce/funnel"] },
      { label: "Executive Reports", to: "/analytics", match: ["/analytics", "/analytics/reports"] },
      { label: "Historical Trends", to: "/analytics/history", match: ["/analytics/history"] },
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
  // longest prefix wins so /intelligence/insights beats /intelligence
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
  const section = useMemo(() => findActiveSection(pathname), [pathname]);
  const activeTab = useMemo(
    () => (section ? findActiveTab(section, pathname) : null),
    [section, pathname],
  );

  if (!section) return null;

  return (
    <div className="sticky top-16 z-[5] -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:-mx-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-end gap-1 overflow-x-auto">
        <div className="mr-3 hidden shrink-0 items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 md:flex">
          {section.label}
          <span className="mx-3 h-3 w-px bg-border" />
        </div>
        {section.tabs.map((t) => {
          const isActive = activeTab?.to === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={[
                "relative whitespace-nowrap px-4 py-3 text-sm transition-colors",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
              <span
                className={[
                  "pointer-events-none absolute inset-x-3 -bottom-px h-[2px] rounded-full transition-all",
                  isActive
                    ? "bg-[color:var(--mint)] shadow-[0_0_10px_color-mix(in_oklab,var(--mint)_60%,transparent)]"
                    : "bg-transparent",
                ].join(" ")}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
