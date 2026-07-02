import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { OpportunityFeedCard } from "@/components/dashboard/opportunity-feed";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/intelligence/insights")({
  head: () => ({ meta: [{ title: "Demand Insights — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "intelligence"),
  component: InsightsPage,
});

function InsightsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Demand Insights"
        description="Auto-generated explanations for every product — why scores moved, what to do about it."
      />
      <OpportunityFeedCard />
    </div>
  );
}
