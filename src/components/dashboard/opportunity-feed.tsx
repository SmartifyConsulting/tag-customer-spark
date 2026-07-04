import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X, RefreshCw, TrendingUp } from "lucide-react";
import { listOpportunityFeed, getExecutiveSummary, dismissInsight, generateNowDailyBrief } from "@/lib/ai.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatZAR(cents?: number | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

export function OpportunityFeedCard() {
  const qc = useQueryClient();
  const feed = useQuery({
    queryKey: ["ai", "opportunity-feed"],
    queryFn: () => listOpportunityFeed(),
    refetchOnWindowFocus: false,
  });
  const exec = useQuery({
    queryKey: ["ai", "executive-summary"],
    queryFn: () => getExecutiveSummary(),
    refetchOnWindowFocus: false,
  });

  const generate = useMutation({
    mutationFn: () => generateNowDailyBrief({ data: undefined }),
    onSuccess: () => {
      toast.success("AI brief refreshed");
      qc.invalidateQueries({ queryKey: ["ai"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not generate brief"),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissInsight({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "opportunity-feed"] }),
  });

  const loading = feed.isLoading || exec.isLoading;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Opportunity Feed
          </CardTitle>
          <CardDescription>
            Today's revenue-generating actions, surfaced automatically.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", generate.isPending && "animate-spin")} />
          {generate.isPending ? "Generating..." : "Refresh brief"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {exec.data && (
              <div className="rounded-xl border bg-primary/[0.04] p-4">
                <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                  Executive briefing
                </div>
                <div className="text-sm font-semibold">{exec.data.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{exec.data.body}</p>
              </div>
            )}

            {!feed.data?.length ? (
              <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
                No opportunities yet. Click <span className="font-medium">Refresh brief</span> to generate today's recommendations.
              </div>
            ) : (
              <ul className="space-y-2">
                {feed.data.map((op: any) => {
                  const value = formatZAR(op.payload?.projected_value_cents);
                  return (
                    <li
                      key={op.id}
                      className="group rounded-lg border p-3 hover:border-primary/30 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{op.title}</span>
                            {value && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                                <TrendingUp className="h-3 w-3" />
                                {value}
                              </span>
                            )}
                            {op.score != null && (
                              <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                                {Math.round(Number(op.score))}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{op.body}</p>
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition"
                          onClick={() => dismiss.mutate(op.id)}
                          aria-label="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
