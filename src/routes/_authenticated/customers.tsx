import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Customers"
      description="Shoppers who opted in to WhatsApp updates via your QR tags."
      icon={Users}
      body="View customer interest history, preferred products, and notification engagement over time."
    />
  ),
});
