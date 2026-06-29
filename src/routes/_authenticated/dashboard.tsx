import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  QrCode,
  Users,
  Banknote,
  Send,
  MousePointerClick,
  AlertTriangle,
  Percent,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { dashboardOverviewQueryOptions } from "@/lib/dashboard";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScanTrendsCard } from "@/components/dashboard/scan-trends-card";
import { CustomerGrowthCard } from "@/components/dashboard/customer-growth-card";
import { TopProductsCard } from "@/components/dashboard/top-products-card";
import { NotificationPerformanceCard } from "@/components/dashboard/notification-performance-card";
import { LowStockCard } from "@/components/dashboard/low-stock-card";
import { PromotionsCard } from "@/components/dashboard/promotions-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tag" },
      {
        name: "description",
        content:
          "Executive overview of in-store scans, customer engagement, notifications and recovered revenue.",
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardOverviewQueryOptions),
  pendingComponent: () => (
    <div className="p-6 sm:p-8">
      <DashboardSkeleton />
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold">Couldn't load your dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error.message ?? "Please try again."}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Dashboard data not found.
    </div>
  ),
  component: DashboardPage,
});

function currencyFmt(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `R ${(cents / 100).toFixed(0)}`;
  }
}

function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { data } = useSuspenseQuery(dashboardOverviewQueryOptions);
  const k = data.kpis;

  const dailySpark = data.scansDaily.slice(-7).map((d) => ({ v: d.count }));
  const growthSpark = data.customerGrowth.slice(-7).map((d) => ({ v: d.total }));
  const notifSpark = data.notificationPerf.slice(-7).map((d) => ({ v: d.sent }));
  const readSpark = data.notificationPerf.slice(-7).map((d) => ({ v: d.read }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="A snapshot of in-store engagement, recovered sales and notification performance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Today's scans"
          value={k.todaysScans}
          delta={k.todaysScansDelta}
          deltaLabel="vs yday"
          icon={QrCode}
          sparkline={dailySpark}
        />
        <KpiCard
          index={1}
          label="Customers waiting"
          value={k.customersWaiting}
          icon={Users}
          tone="success"
          sparkline={growthSpark}
        />
        <KpiCard
          index={2}
          label="Revenue recovered"
          value={k.revenueRecoveredCents}
          formatted={currencyFmt(k.revenueRecoveredCents, k.currency)}
          icon={Banknote}
          tone="success"
        />
        <KpiCard
          index={3}
          label="Top product interest"
          value={k.topProductInterestCount}
          formatted={
            k.topProductName
              ? `${k.topProductInterestCount} · ${k.topProductName}`
              : "—"
          }
          icon={Sparkles}
        />
        <KpiCard
          index={4}
          label="Notifications sent (14d)"
          value={k.notificationsSent}
          icon={Send}
          sparkline={notifSpark}
        />
        <KpiCard
          index={5}
          label="Notification conversion"
          value={k.notificationConversionPct}
          formatted={`${k.notificationConversionPct}%`}
          icon={MousePointerClick}
          tone="success"
          sparkline={readSpark}
        />
        <KpiCard
          index={6}
          label="Low stock products"
          value={k.lowStockCount}
          icon={AlertTriangle}
          tone="warning"
        />
        <KpiCard
          index={7}
          label="On promotion"
          value={k.onPromotionCount}
          icon={Percent}
          tone="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScanTrendsCard
            daily={data.scansDaily}
            weekly={data.scansWeekly}
            monthly={data.scansMonthly}
          />
        </div>
        <CustomerGrowthCard data={data.customerGrowth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopProductsCard products={data.topProducts} />
        <NotificationPerformanceCard data={data.notificationPerf} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LowStockCard products={data.lowStockProducts} />
        <PromotionsCard promotions={data.promotionProducts} />
        <RecentActivityCard items={data.recentActivity} />
      </div>
    </div>
  );
}
