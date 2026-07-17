import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProductDetailView } from "@/components/products/product-detail-view";

export const Route = createFileRoute("/_authenticated/products/$productId")({
  head: () => ({ meta: [{ title: "Product — Tag" }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { productId } = useParams({ from: "/_authenticated/products/$productId" });
  return <ProductDetailView productId={productId} backTo="/products" backLabel="Products" />;
}
