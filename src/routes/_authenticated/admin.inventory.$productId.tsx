import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProductDetailView } from "@/components/products/product-detail-view";

export const Route = createFileRoute("/_authenticated/admin/inventory/$productId")({
  head: () => ({ meta: [{ title: "Product — Inventory — Tag" }] }),
  component: AdminProductDetail,
});

function AdminProductDetail() {
  const { productId } = useParams({ from: "/_authenticated/admin/inventory/$productId" });
  return (
    <ProductDetailView productId={productId} backTo="/admin/inventory" backLabel="Inventory" />
  );
}
