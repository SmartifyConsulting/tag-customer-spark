import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ownership/shared";
import { globalOwnershipSearch } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/purchase/search")({
  head: () => ({
    meta: [
      { title: "Search Purchases — Tag Purchase" },
      {
        name: "description",
        content:
          "Find any product, receipt, customer, store, warranty, return or serial number in one search.",
      },
      { property: "og:title", content: "Search Purchases — Tag Purchase" },
      {
        property: "og:description",
        content:
          "Find any product, receipt, customer, store, warranty, return or serial number in one search.",
      },
    ],
  }),
  component: PurchaseSearchPage,
});

function PurchaseSearchPage() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const searchFn = useServerFn(globalOwnershipSearch);

  // Debounce so each keystroke doesn't fan out across every entity table.
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "global-search", term],
    queryFn: () => searchFn({ data: { q: term } }),
    enabled: term.length > 1,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const hit of ((data ?? []) as any[])) {
      map.set(hit.kind, [...(map.get(hit.kind) ?? []), hit]);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Search"
        description="One search box across products, receipts, customers, stores, warranties, returns, owned products and serial numbers."
      />

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Product, receipt number, serial number, customer, store…"
          className="pl-9"
        />
      </div>

      {term.length < 2 ? (
        <p className="text-sm text-muted-foreground">Start typing to search the whole record.</p>
      ) : isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nothing matched “{term}”.
          </CardContent>
        </Card>
      ) : (
        grouped.map(([kind, hits]) => (
          <section key={kind} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {kind} · {hits.length}
            </h2>
            <div className="grid gap-2">
              {hits.map((h) => (
                <Card key={`${kind}-${h.id}`}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <Link to={h.to} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {h.title}
                    </Link>
                    {h.subtitle && (
                      <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                    )}
                    <StatusBadge tone="info">{kind}</StatusBadge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
