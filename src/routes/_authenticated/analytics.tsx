import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { QrCode, Users, DollarSign, Repeat } from "lucide-react";
import { requireFeature } from "@/lib/tier-guard";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScanTrendsCard } from "@/components/dashboard/scan-trends-card";
import { TopProductsCard } from "@/components/dashboard/top-products-card";
import { CustomerGrowthCard } from "@/components/dashboard/customer-growth-card";
import { ScanHeatmap, ScanHeatmapLegend } from "@/components/dashboard/scan-heatmap";
import {
  advancedAnalyticsQueryOptions,
  dashboardOverviewQueryOptions,
} from "@/lib/dashboard";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "roi"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(dashboardOverviewQueryOptions),
      context.queryClient.ensureQueryData(advancedAnalyticsQueryOptions(30)),
    ]),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data: overview } = useSuspenseQuery(dashboardOverviewQueryOptions);
  const analyticsQuery = useQuery(advancedAnalyticsQueryOptions(days));
  const a = analyticsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Deep-dive view of scans, customer growth, and revenue attribution."
        actions={
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7d</TabsTrigger>
              <TabsTrigger value="30">30d</TabsTrigger>
              <TabsTrigger value="90">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={0}
            label="Total scans"
            value={a?.totals.totalScans ?? 0}
            icon={QrCode}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={1}
            label="Unique customers"
            value={a?.totals.uniqueCustomers ?? 0}
            icon={Users}
            tone="success"
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={2}
            label="Returning scans"
            value={a?.totals.returningCustomers ?? 0}
            icon={Repeat}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={3}
            label="Recovered revenue"
            value={a ? Math.round(a.totals.recoveredCents / 100) : 0}
            formatted={
              a
                ? formatMoney(a.totals.recoveredCents, a.totals.currency, {
                    maximumFractionDigits: 0,
                  })
                : "—"
            }
            icon={DollarSign}
            tone="success"
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <ScanTrendsCard
            daily={overview.scansDaily}
            weekly={overview.scansWeekly}
            monthly={overview.scansMonthly}
          />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <CustomerGrowthCard data={overview.customerGrowth} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6">
          <TopProductsCard products={overview.topProducts as any} />
        </div>
        <Card className="col-span-12 lg:col-span-6 p-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Scan heatmap</h3>
            <ScanHeatmapLegend />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Scans by day of week × hour of day — spot the shopping peaks.
          </p>
          {a ? <ScanHeatmap data={a.heatmap} /> : <Skeleton className="h-56 w-full" />}
        </Card>
      </div>
    </div>
  );
}
