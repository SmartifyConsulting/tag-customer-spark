import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({ meta: [{ title: "AI Intelligence — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "intelligence"),
  component: IntelligenceLayout,
});

// Each child page renders its own PageHeader followed by <IntelligenceTabs />
// (heading first, tabs directly under it, then the page's own content) —
// see intelligence.index.tsx etc. Nothing shared belongs above the Outlet.
function IntelligenceLayout() {
  return <Outlet />;
}

