import { Link, useRouterState } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tab strip shown at the top of every Intelligence-family page so the user
// can jump between Overview, Insights, Analytics, ROI, Trends and Forecasting
// without needing a sidebar accordion. Analytics and ROI live outside the
// /intelligence layout, so this is rendered per-page rather than in a shared
// Outlet.
const TABS = [
  { label: "Overview", to: "/intelligence" as const },
  { label: "Insights", to: "/intelligence/insights" as const },
  { label: "Analytics", to: "/analytics" as const },
  { label: "ROI", to: "/roi" as const },
  { label: "Trends", to: "/intelligence/trends" as const },
  { label: "Forecasting", to: "/intelligence/forecasting" as const },
];

export function IntelligenceTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active =
    TABS.find((tab) =>
      tab.to === "/intelligence" ? pathname === tab.to : pathname.startsWith(tab.to),
    )?.to ?? "/intelligence";

  return (
    <Tabs value={active}>
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.to} value={tab.to} asChild>
            <Link to={tab.to}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
