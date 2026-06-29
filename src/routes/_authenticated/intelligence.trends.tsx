import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listProducts } from "@/lib/products.functions";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/intelligence/trends")({
  head: () => ({ meta: [{ title: "Trend Detection — Tag" }] }),
  component: TrendsPage,
});

const TREND_META = {
  rising: { label: "Rising", icon: TrendingUp, tone: "bg-[color:var(--mint)]/15 text-[color:var(--mint)]" },
  falling: { label: "Falling", icon: TrendingDown, tone: "bg-destructive/15 text-destructive" },
  stable: { label: "Stable", icon: Minus, tone: "bg-muted text-muted-foreground" },
} as const;

function TrendsPage() {
  const list = useServerFn(listProducts);
  const { data, isLoading } = useQuery({
    queryKey: ["products", "trends"],
    queryFn: () => list({ data: { sort: "recent", page: 1, pageSize: 50 } as any }),
  });

  const rows = ((data?.rows ?? []) as any[]).filter((r) => r.intent_score != null);
  const buckets = {
    rising: rows.filter((r) => r.intent_score_trend === "rising"),
    falling: rows.filter((r) => r.intent_score_trend === "falling"),
    stable: rows.filter((r) => r.intent_score_trend === "stable" || !r.intent_score_trend),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Trend Detection"
        description="Automatic classification of every product as rising, stable or falling — based on Intent Score momentum."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {(["rising", "stable", "falling"] as const).map((kind) => {
          const meta = TREND_META[kind];
          const items = buckets[kind];
          return (
            <Card key={kind} className="rounded-xl shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${meta.tone}`}>
                    <meta.icon className="h-4 w-4" />
                  </span>
                  {meta.label}
                </CardTitle>
                <CardDescription>{items.length} products</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
                ) : items.length === 0 ? (
                  <EmptyState icon={Activity} title="No products" />
                ) : (
                  items.slice(0, 10).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.sku}</p>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {Math.round(p.intent_score)}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
