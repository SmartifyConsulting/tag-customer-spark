import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Dashboard"
      description="A snapshot of in-store engagement, recovered sales, and notification performance."
      icon={LayoutDashboard}
      body="Your activity overview will appear here — scan volume, opt-in rates, top tagged products, and recovered revenue."
    />
  ),
});
