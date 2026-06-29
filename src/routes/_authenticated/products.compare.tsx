import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GitCompareArrows, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { listProducts } from "@/lib/products.functions";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/products/compare")({
  head: () => ({ meta: [{ title: "Performance Compare — Tag" }] }),
  component: ComparePage,
});

function ComparePage() {
  const list = useServerFn(listProducts);
  const { data, isLoading } = useQuery({
    queryKey: ["products", "compare"],
    queryFn: () => list({ data: { sort: "recent", page: 1, pageSize: 30 } as any }),
  });

  const rows = ((data?.rows ?? []) as any[])
    .filter((r) => r.intent_score != null)
    .sort((a, b) => (b.intent_score ?? 0) - (a.intent_score ?? 0));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance Compare"
        description="Side-by-side intent, stock and price comparison across your catalogue."
      />

      <Card className="rounded-xl shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-[color:var(--mint)]" />
            Top performers by Intent
          </CardTitle>
          <CardDescription>Sorted by current intent score.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={GitCompareArrows} title="Nothing to compare yet" />
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 20).map((p) => (
                <Link
                  key={p.id}
                  to="/products/$productId"
                  params={{ productId: p.id }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-accent/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                    {p.sku?.slice(-3) ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock {p.stock_qty} · {p.brand ?? "—"}
                    </p>
                  </div>
                  <div className="flex w-44 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[color:var(--mint)]"
                        style={{ width: `${Math.min(100, p.intent_score ?? 0)}%` }}
                      />
                    </div>
                    <Badge variant="secondary" className="tabular-nums">
                      {Math.round(p.intent_score ?? 0)}
                    </Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
