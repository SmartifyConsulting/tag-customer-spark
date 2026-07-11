import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({ meta: [{ title: "AI Intelligence — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "intelligence"),
  component: IntelligenceLayout,
});

const TABS = [
  { label: "Overview", to: "/intelligence" },
  { label: "Insights", to: "/intelligence/insights" },
  { label: "Trends", to: "/intelligence/trends" },
  { label: "Forecasting", to: "/intelligence/forecasting" },
] as const;

function IntelligenceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active =
    TABS.find((tab) => (tab.to === "/intelligence" ? pathname === tab.to : pathname.startsWith(tab.to)))?.to ??
    "/intelligence";

  return (
    <div className="space-y-8">
      <Tabs value={active}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.to} value={tab.to} asChild>
              <Link to={tab.to}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Outlet />
    </div>
  );
}
