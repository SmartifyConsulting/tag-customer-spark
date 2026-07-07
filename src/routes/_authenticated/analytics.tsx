import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { requireFeature } from "@/lib/tier-guard";
import { PageHeader } from "@/components/page-header";
import { OpportunityFeedCard } from "@/components/dashboard/opportunity-feed";
import { CustomerGrowthCard } from "@/components/dashboard/customer-growth-card";
import { dashboardOverviewQueryOptions } from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Intelligence — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "roi"),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardOverviewQueryOptions),
  component: IntelligencePage,
});

function IntelligencePage() {
  const { data } = useSuspenseQuery(dashboardOverviewQueryOptions);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Intelligence"
        description="AI-surfaced opportunities across your retail network."
      />
      <OpportunityFeedCard />
      <CustomerGrowthCard data={data.customerGrowth} />
    </div>
  );
}
