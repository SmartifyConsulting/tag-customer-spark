import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/stores")({
  head: () => ({ meta: [{ title: "Stores — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Stores"
      description="Manage the physical retail locations using Tag."
      icon={Store}
      body="Add stores, assign managers and staff, and view per-store engagement metrics."
    />
  ),
});
