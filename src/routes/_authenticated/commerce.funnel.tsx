import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PieChart as PieIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listCampaigns } from "@/lib/notifications.functions";
import { EmptyState } from "@/components/empty-state";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/commerce/funnel")({
  head: () => ({ meta: [{ title: "Conversion Funnel — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "roi"),
  component: FunnelPage,
});

function FunnelPage() {
  const list = useServerFn(listCampaigns);
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", "funnel"],
    queryFn: () => list({ data: { status: "all" } }),
  });

  const totals = ((data ?? []) as any[]).reduce(
    (acc, c) => {
      const f = c.funnel ?? {};
      acc.queued += f.queued ?? 0;
      acc.sent += f.sent ?? 0;
      acc.read += f.read ?? 0;
      acc.clicked += f.clicked ?? 0;
      acc.redeemed += f.redeemed ?? 0;
      return acc;
    },
    { queued: 0, sent: 0, read: 0, clicked: 0, redeemed: 0 },
  );

  const stages = [
    { label: "Queued", value: totals.queued, tone: "bg-muted-foreground/40" },
    { label: "Sent", value: totals.sent, tone: "bg-primary" },
    { label: "Read", value: totals.read, tone: "bg-[color:var(--mint)]" },
    { label: "Clicked", value: totals.clicked, tone: "bg-[color:var(--warning)]" },
    { label: "Redeemed", value: totals.redeemed, tone: "bg-success" },
  ];
  const top = Math.max(1, totals.sent);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Conversion Funnel"
        description="End-to-end conversion from notification queue to in-store redemption."
      />

      <Card className="rounded-xl shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-[color:var(--mint)]" />
            All-campaign funnel
          </CardTitle>
          <CardDescription>Aggregated across every campaign in the workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : totals.sent === 0 ? (
            <EmptyState icon={PieIcon} title="No funnel data yet" description="Send a campaign to see conversions roll in here." />
          ) : (
            <div className="space-y-3">
              {stages.map((s) => {
                const pct = Math.round((s.value / top) * 100);
                return (
                  <div key={s.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.value.toLocaleString()} · {pct}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${s.tone}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
