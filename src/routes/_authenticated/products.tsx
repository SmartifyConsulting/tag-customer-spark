import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Products"
      description="Manage the catalog of products that can be tagged in-store."
      icon={Package}
      body="Add, import, and organize products. Each product can be linked to one or more QR tags placed on shelves."
    />
  ),
});
