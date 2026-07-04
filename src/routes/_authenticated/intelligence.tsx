import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { OpportunityFeedCard } from "@/components/dashboard/opportunity-feed";
import { listWeeklyReports, generateNowWeeklyReport, getExecutiveSummary } from "@/lib/ai.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CalendarRange, FileText, RefreshCw } from "lucide-react";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({ meta: [{ title: "AI Intelligence — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "intelligence"),
  component: IntelligencePage,
});

function IntelligencePage() {
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ["ai", "weekly-reports"], queryFn: () => listWeeklyReports() });
  const exec = useQuery({ queryKey: ["ai", "executive-summary"], queryFn: () => getExecutiveSummary() });

  const generate = useMutation({
    mutationFn: () => generateNowWeeklyReport({ data: undefined }),
    onSuccess: () => {
      toast.success("Weekly report generated");
      qc.invalidateQueries({ queryKey: ["ai", "weekly-reports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not generate"),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Retail Intelligence"
        description="Daily opportunities, executive briefings and weekly performance reports — generated automatically."
      />

      <OpportunityFeedCard />

      {exec.data?.payload && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Today's executive briefing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-lg font-semibold">{(exec.data.payload as any).headline}</div>
            <p className="text-sm text-muted-foreground">{(exec.data.payload as any).summary}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-success/10 p-4">
                <div className="text-xs uppercase tracking-wide text-success font-semibold mb-2">Highlights</div>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  {((exec.data.payload as any).highlights ?? []).map((h: string, i: number) => <li key={i}>{h}</li>)}
                </ul>
              </div>
              <div className="rounded-lg border bg-amber-50/40 dark:bg-amber-500/5 p-4">
                <div className="text-xs uppercase tracking-wide text-amber-800 dark:text-amber-400 font-semibold mb-2">Watch-outs</div>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  {((exec.data.payload as any).watchouts ?? []).map((h: string, i: number) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              Weekly retailer reports
            </CardTitle>
            <CardDescription>Deep-dive performance & recommendations, generated weekly.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${generate.isPending ? "animate-spin" : ""}`} />
            Generate this week's
          </Button>
        </CardHeader>
        <CardContent>
          {reports.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !reports.data?.length ? (
            <div className="text-sm text-muted-foreground rounded-md border border-dashed p-6 text-center">
              No weekly reports yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reports.data.map((r: any) => {
                const p = r.payload ?? {};
                return (
                  <details key={r.id} className="rounded-lg border p-4 group open:bg-muted/30">
                    <summary className="cursor-pointer flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.generated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground group-open:hidden">View</span>
                    </summary>
                    <div className="mt-4 space-y-3 text-sm">
                      <p className="text-muted-foreground">{p.executive_overview}</p>
                      <Section title="Wins" items={p.wins} />
                      <Section title="Problems" items={p.problems} />
                      <Section title="Actions for next week" items={p.next_week_actions} />
                      {p.metrics_commentary && (
                        <div>
                          <div className="font-medium mb-1">Metrics commentary</div>
                          <p className="text-muted-foreground">{p.metrics_commentary}</p>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="font-medium mb-1">{title}</div>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}
