import { createFileRoute } from "@tanstack/react-router";
import { requireFeature } from "@/lib/tier-guard";
import { PageHeader } from "@/components/page-header";
import { OpportunityFeedCard } from "@/components/dashboard/opportunity-feed";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Intelligence — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "roi"),
  component: IntelligencePage,
});

function IntelligencePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Intelligence"
        description="AI-surfaced opportunities across your retail network."
      />
      <OpportunityFeedCard />
    </div>
  );
}
