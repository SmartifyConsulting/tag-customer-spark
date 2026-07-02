import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/analytics/history")({
  head: () => ({ meta: [{ title: "Historical Trends — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "roi"),
  component: () => (
    <PlaceholderPage
      title="Historical Trends"
      description="Read-only historical analytics across scans, conversions and revenue."
      icon={History}
      body="Long-range trend charts live here. The analytics module is intentionally read-only — no scoring or forecasting happens in this layer."
    />
  ),
});
