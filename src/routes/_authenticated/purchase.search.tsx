import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ownership/shared";
import { formatMoney } from "@/lib/format";
import { listPurchases } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/purchase/search")({
  head: () => ({
    meta: [
      { title: "Search Purchases — Tag Purchase" },
      {
        name: "description",
        content: "Find any purchase, product line, store or receipt number across the ownership record.",
      },
      { property: "og:title", content: "Search Purchases — Tag Purchase" },
      {
        property: "og:description",
        content: "Find any purchase, product line, store or receipt number across the ownership record.",
      },
    ],
  }),
  component: PurchaseSearchPage,
});

function PurchaseSearchPage() {
  const [query, setQuery] = useState("");
  const listFn = useServerFn(listPurchases);
  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "purchases", "search-all"],
    queryFn: () => listFn({ data: {} }),
  });

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const purchases = ((data as any)?.purchases ?? []) as any[];
    if (!term) return [];
    return purchases.filter((p) => {
      const haystack = [
        p.receipt_number,
        p.store?.name,
        p.store?.city,
        ...((p.items ?? []) as any[]).flatMap((i) => [i.product_name, i.brand, i.category]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, query]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Search"
        description="One search box across every purchase, product line, store and receipt number."
      />

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try a product name, brand, store or receipt number"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !query.trim() ? (
        <p className="text-sm text-muted-foreground">Start typing to search the ownership record.</p>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nothing matched “{query}”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {results.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/ownership/purchases/$purchaseId"
                    params={{ purchaseId: p.id }}
                    className="truncate font-medium hover:underline"
                  >
                    {p.receipt_number ?? "Purchase"}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.store?.name ?? "Store"} ·{" "}
                    {p.purchased_at ? new Date(p.purchased_at).toLocaleDateString() : "—"} ·{" "}
                    {((p.items ?? []) as any[]).map((i) => i.product_name).join(", ")}
                  </p>
                </div>
                <StatusBadge tone="info">{((p.items ?? []) as any[]).length} item(s)</StatusBadge>
                <p className="font-semibold">{formatMoney(p.total_cents ?? 0)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
