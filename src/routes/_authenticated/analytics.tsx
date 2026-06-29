import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Analytics"
      description="Measure the impact of Tag on recovered revenue and customer behavior."
      icon={BarChart3}
      body="Scan-to-opt-in conversion, notification click-throughs, and store-by-store performance will live here."
    />
  ),
});
