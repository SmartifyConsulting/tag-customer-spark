import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PackageCheck, AlertTriangle } from "lucide-react";

export function LowStockCard({
  products,
}: {
  products: { id: string; name: string; stockQty: number; lowStockThreshold: number }[];
}) {
  return (
    <Card className="rounded-2xl animate-fade-in" style={{ animationDelay: "360ms", animationFillMode: "backwards" }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Low stock</CardTitle>
          <p className="text-xs text-muted-foreground">At or below the alert threshold</p>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-warning/10 text-warning">
          <AlertTriangle className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <EmptyState icon={PackageCheck} title="All stocked up" description="No products are currently below their reorder threshold." />
        ) : (
          <ul className="space-y-2">
            {products.map((p, i) => {
              const out = p.stockQty <= 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2.5 transition-colors hover:bg-accent/40 animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Threshold {p.lowStockThreshold}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      out
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                        : "bg-warning/10 text-warning hover:bg-warning/15"
                    }
                  >
                    {out ? "Out of stock" : `${p.stockQty} left`}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
