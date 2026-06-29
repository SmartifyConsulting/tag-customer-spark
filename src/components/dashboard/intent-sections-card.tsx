import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { listIntentSections } from "@/lib/intent.functions";
import { IntentBadge } from "@/components/intent/intent-badge";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, TrendingUp, AlertCircle } from "lucide-react";

const SECTION = {
  high:    { title: "High intent products",   icon: Flame,        desc: "Score above 75 — your demand leaders." },
  rising:  { title: "Rising intent",          icon: TrendingUp,   desc: "Fastest growing intent score this week." },
  gap:     { title: "Conversion gap products",icon: AlertCircle,  desc: "Plenty of intent but low conversion." },
} as const;

export function IntentSectionsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["intent", "sections"],
    queryFn: () => listIntentSections(),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["high","rising","gap"] as const).map((key) => {
        const meta = SECTION[key];
        const items = (data as any)?.[key] ?? [];
        const Icon = meta.icon;
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-primary" />
                {meta.title}
              </CardTitle>
              <CardDescription>{meta.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="text-sm text-muted-foreground rounded-md border border-dashed p-4 text-center">
                  No products in this segment yet.
                </div>
              ) : (
                <ul className="space-y-1">
                  {items.map((p: any) => (
                    <li key={p.id}>
                      <Link
                        to="/products/$productId"
                        params={{ productId: p.id }}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition"
                      >
                        <span className="text-sm truncate">{p.name}</span>
                        <IntentBadge score={p.intent_score} trend={p.intent_score_trend} confidence={p.intent_score_confidence} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
