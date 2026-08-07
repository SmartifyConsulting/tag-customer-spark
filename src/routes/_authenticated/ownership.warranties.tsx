import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, WarrantyProgress, warrantyState } from "@/components/ownership/shared";
import { listWarranties } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/warranties")({
  head: () => ({
    meta: [
      { title: "Warranties — Tag Ownership" },
      { name: "description", content: "Every active warranty, expiry date and open claim in one place." },
    ],
  }),
  component: WarrantiesPage,
});

function WarrantiesPage() {
  const listFn = useServerFn(listWarranties);
  const { data, isLoading } = useQuery({ queryKey: ["ownership", "warranties"], queryFn: () => listFn() });
  const rows = ((data as any[]) ?? []).map((w) => ({ ...w, state: warrantyState(w.expires_on) }));
  const expiring = rows.filter((r) => r.state.tone === "soon");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Warranties"
        description="Track cover, register products and raise claims before the window closes."
      />

      {expiring.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-5 text-sm">
            <span className="font-semibold">{expiring.length} warranties</span> expire within 60 days.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No warranties recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((w) => (
            <Link
              key={w.id}
              to="/ownership/products/$productId"
              params={{ productId: w.product?.id ?? w.owned_product_id }}
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    {w.product?.image_url && (
                      <img
                        src={w.product.image_url}
                        alt={w.product?.name ?? "Product"}
                        loading="lazy"
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{w.product?.name ?? "Product"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {w.product?.brand ?? ""} {w.months ? `· ${w.months} months` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge tone={w.state.tone}>{w.state.label}</StatusBadge>
                    <StatusBadge tone={w.registered_at ? "ok" : "muted"}>
                      {w.registered_at ? "Registered" : "Not registered"}
                    </StatusBadge>
                    {(w.claims ?? []).length > 0 && (
                      <StatusBadge tone="info">{w.claims.length} claims</StatusBadge>
                    )}
                  </div>
                  <WarrantyProgress startsOn={w.starts_on} expiresOn={w.expires_on} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
