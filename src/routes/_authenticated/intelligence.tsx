import { createFileRoute, Outlet } from "@tanstack/react-router";
import { IntelligenceTabs } from "@/components/intelligence-tabs";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({ meta: [{ title: "AI Intelligence — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "intelligence"),
  component: IntelligenceLayout,
});

function IntelligenceLayout() {
  return (
    <div className="space-y-8">
      <IntelligenceTabs />
      <Outlet />
    </div>
  );
}

