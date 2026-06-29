import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Tag, Percent } from "lucide-react";

function daysUntil(iso: string | null): string {
  if (!iso) return "Ongoing";
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}

export function PromotionsCard({
  promotions,
}: {
  promotions: { id: string; name: string; discountPct: number; endsAt: string | null }[];
}) {
  return (
    <Card className="rounded-2xl animate-fade-in" style={{ animationDelay: "420ms", animationFillMode: "backwards" }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Active promotions</CardTitle>
          <p className="text-xs text-muted-foreground">Live offers customers can claim</p>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
          <Percent className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        {promotions.length === 0 ? (
          <EmptyState icon={Tag} title="No active promotions" description="Create a promotion to drive recovered sales." />
        ) : (
          <ul className="space-y-2">
            {promotions.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2.5 transition-colors hover:bg-accent/40 animate-fade-in"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{daysUntil(p.endsAt)}</p>
                </div>
                <Badge variant="secondary" className="bg-success/10 text-success hover:bg-success/15">
                  {p.discountPct > 0 ? `${p.discountPct}% off` : "Live"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
