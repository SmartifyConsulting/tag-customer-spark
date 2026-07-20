import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  PackageOpen,
  ScanLine,
  QrCode,
  Users,
  Tag,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  briefingQueryOptions,
  dashboardOverviewQueryOptions,
  advancedAnalyticsQueryOptions,
} from "@/lib/dashboard";
import { useAuth } from "@/hooks/use-auth";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScanHeatmap, ScanHeatmapLegend } from "@/components/dashboard/scan-heatmap";
import { IntentSectionsCard } from "@/components/dashboard/intent-sections-card";

export const Route = createFileRoute("/_authenticated/briefing")({
  head: () => ({ meta: [{ title: "Briefing — Tag" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(briefingQueryOptions),
      context.queryClient.ensureQueryData(dashboardOverviewQueryOptions),
      context.queryClient.ensureQueryData(advancedAnalyticsQueryOptions(30)),
    ]),
  component: BriefingPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <p className="text-destructive">Could not load your briefing: {error.message}</p>
      <button className="mt-3 underline" onClick={reset}>Retry</button>
    </div>
  ),
  notFoundComponent: () => <p className="p-6">Not found.</p>,
});

function BriefingPage() {
  const { user } = useAuth();
  const { data } = useSuspenseQuery(briefingQueryOptions);
  const { data: overview } = useSuspenseQuery(dashboardOverviewQueryOptions);
  const analyticsQuery = useQuery(advancedAnalyticsQueryOptions(30));
  const analytics = analyticsQuery.data;
  const first = user?.user_metadata?.full_name?.split(" ")?.[0] ?? "there";
  const greeting = data.greetingName ?? first;

  const k = overview.kpis;
  const dailySpark = overview.scansDaily.slice(-7).map((d) => ({ v: d.count }));
  const growthSpark = overview.customerGrowth.slice(-7).map((d) => ({ v: d.total }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello ${greeting}`}
        description="Your daily briefing — scans, waiting customers, and freshly tagged products."
      />

      {/* Row 1 — KPI tiles */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={0}
            label="Today's scans"
            value={k.todaysScans}
            delta={k.todaysScansDelta}
            deltaLabel="vs yday"
            icon={QrCode}
            sparkline={dailySpark}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={1}
            label="Customers waiting"
            value={k.customersWaiting}
            icon={Users}
            tone="success"
            sparkline={growthSpark}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard index={2} label="Tagged today" value={data.taggedTodayCount} icon={Tag} />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={3}
            label="Unread WhatsApps"
            value={data.unread.length}
            icon={Inbox}
            tone={data.unread.length > 0 ? "warning" : "default"}
          />
        </div>
      </div>

      {/* Row 2 — Heatmap + Intent */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-8 p-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Scan heatmap</h3>
            <ScanHeatmapLegend />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Shopper scans by day of week × hour of day — darker cells mean more scans in that slot.
          </p>
          {analytics ? (
            <ScanHeatmap data={analytics.heatmap} />
          ) : (
            <Skeleton className="h-56 w-full" />
          )}
        </Card>
        <div className="col-span-12 lg:col-span-4">
          <IntentSectionsCard />
        </div>
      </div>

      {/* Row 3 — Tagged products + Unread WhatsApps */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-8 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <PackageOpen className="h-4 w-4" /> Tagged products
            </h2>
            <span className="text-xs text-muted-foreground">
              {data.totalTagged} tag{data.totalTagged === 1 ? "" : "s"} this month
            </span>
          </div>
          {data.buckets.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No tagged products yet"
              description="Products appear here once they've been assigned a GTIN and QR code."
            />
          ) : (
            <Accordion type="multiple" className="w-full">
              {data.buckets.map((b) => (
                <AccordionItem key={b.key} value={b.key}>
                  <AccordionTrigger className="text-sm">
                    <span className="flex-1 text-left font-medium">{b.label}</span>
                    <Badge variant="secondary" className="ml-2 mr-3">
                      {b.products.length}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="divide-y">
                      {b.products.map((p) => (
                        <li key={p.id}>
                          <Link
                            to="/admin/inventory/$productId"
                            params={{ productId: p.id }}
                            className="flex items-center gap-3 px-1 py-2 hover:bg-muted/40"
                          >
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt=""
                                className="h-9 w-9 rounded object-cover"
                              />
                            ) : (
                              <div className="grid h-9 w-9 place-items-center rounded bg-muted">
                                <ScanLine className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{p.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {p.gtin ?? "no GTIN"} ·{" "}
                                {new Date(p.last_tagged_at).toLocaleDateString()}
                              </p>
                            </div>
                            {p.count > 1 && (
                              <Badge variant="outline" className="shrink-0">
                                ×{p.count}
                              </Badge>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>

        <Card className="col-span-12 lg:col-span-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="h-4 w-4" /> Unread WhatsApps
            </h2>
            <Link to="/inbox" className="text-xs text-muted-foreground hover:underline">
              Open inbox →
            </Link>
          </div>
          {data.unread.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Inbox zero"
              description="No shoppers waiting on a reply. Nice work."
            />
          ) : (
            <ul className="divide-y">
              {data.unread.map((c) => (
                <li key={c.conversation_id}>
                  <Link to="/inbox" className="flex items-start gap-3 py-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">
                          {c.customer_name || c.customer_phone || "Unknown"}
                        </span>
                        <Badge className="ml-auto shrink-0">{c.unread_count}</Badge>
                      </p>
                      {c.last_message && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {c.last_message}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(c.last_message_at).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
