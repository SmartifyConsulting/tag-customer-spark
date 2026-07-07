import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getSignalContributions, type SignalContribution } from "@/lib/dashboard.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Image as ImageIcon } from "lucide-react";

export function SignalContributionsCard() {
  const [active, setActive] = useState<SignalContribution | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "signal-contributions"],
    queryFn: () => getSignalContributions(),
    staleTime: 60_000,
  });

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Signal contributions</CardTitle>
          <p className="text-xs text-muted-foreground">
            How each intent signal contributes to your workspace's overall intent score. Click a signal to see the top products driving it.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-3">
              {(data?.contributions ?? []).map((c) => (
                <button
                  key={c.key}
                  onClick={() => setActive(c)}
                  className="group flex flex-col gap-1 text-left"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground group-hover:text-foreground">
                      {c.label}
                    </span>
                    <span className="tabular-nums font-medium text-foreground">
                      {c.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-amber-500 transition-all group-hover:bg-amber-600"
                      style={{ width: `${Math.min(100, c.pct)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{active?.label}</SheetTitle>
            <SheetDescription>
              Top products contributing to this signal — click through for detail.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {active && data?.breakdown[active.key]?.length ? (
              data.breakdown[active.key].map((p) => (
                <Link
                  key={p.product_id}
                  to="/products/$productId"
                  params={{ productId: p.product_id }}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      Value {p.raw.toFixed(2)} · {p.contribution_pct}% of signal
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No product activity for this signal yet.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
