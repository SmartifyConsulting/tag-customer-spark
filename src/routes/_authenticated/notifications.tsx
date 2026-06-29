import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Notifications"
      description="Send WhatsApp updates for sales, low stock, restocks, and promotions."
      icon={Bell}
      body="Compose messages, target interested customers by product, and track delivery and engagement."
    />
  ),
});
