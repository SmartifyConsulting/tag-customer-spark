import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { listMyTaggedProducts } from "@/lib/tagged.functions";

export const Route = createFileRoute("/_authenticated/tagged")({
  head: () => ({
    meta: [
      { title: "Tagged — Tag" },
      { name: "description", content: "Products you've scanned and asked to be notified about." },
    ],
  }),
  component: TaggedPage,
});

function TaggedPage() {
  const listFn = useServerFn(listMyTaggedProducts);
  const { data, isLoading } = useQuery({ queryKey: ["tagged"], queryFn: () => listFn() });
  const items = (data as any)?.items ?? [];
  const linked = (data as any)?.linked ?? true;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tagged"
        description="Products you've scanned in-store and asked to be notified about — not yet purchased."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !linked ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Add your WhatsApp number in your{" "}
            <Link to="/profile" className="font-medium underline underline-offset-4">
              Profile
            </Link>{" "}
            to see products you've tagged in-store.
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing tagged yet. Scan a product's barcode in-store and choose "Follow Me" to
            get notified about it here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((i: any) => {
            const p = i.product;
            const image = p?.hero_image ?? p?.image_url;
            const price = p?.sale_price_cents ?? p?.price_cents;
            return (
              <Card key={i.id} className="overflow-hidden">
                <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                  {image ? (
                    <img src={image} alt={p?.name ?? "Product"} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p?.name ?? "Product"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p?.brand ? `${p.brand} · ` : ""}
                        {i.retailer?.name ?? ""}
                      </p>
                    </div>
                    {price != null && <p className="shrink-0 text-sm font-semibold">{formatMoney(price)}</p>}
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" /> Tagged {new Date(i.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
