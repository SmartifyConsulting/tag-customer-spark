import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart2 } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/analytics/reports")({
  head: () => ({ meta: [{ title: "Reports & Exports — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "roi"),
  component: () => (
    <PlaceholderPage
      title="Reports & Exports"
      description="Scheduled and on-demand exports — CSV, Excel and PDF."
      icon={FileBarChart2}
      body="Configure scheduled exports and download point-in-time reports from this surface. CSV / Excel / PDF formats are already available from the Analytics dashboard."
    />
  ),
});
