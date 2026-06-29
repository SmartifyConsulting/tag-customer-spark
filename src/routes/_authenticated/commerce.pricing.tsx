import { createFileRoute } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/commerce/pricing")({
  head: () => ({ meta: [{ title: "Pricing Sensitivity — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Pricing Sensitivity"
      description="Discount elasticity and price-point demand response across your catalogue."
      icon={Tag}
      body="Pricing sensitivity charts roll into this view once your next promotion cycle completes. The engine already learns from every promotion event — no setup needed."
    />
  ),
});
