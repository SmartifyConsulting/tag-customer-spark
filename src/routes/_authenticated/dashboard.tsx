import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import {
  QrCode,
  Users,
  Banknote,
  Send,
  MousePointerClick,
  Download,
  FileSpreadsheet,
  FileText,
  Clock,
  UserCheck,
  UsersRound,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  advancedAnalyticsQueryOptions,
  dashboardOverviewQueryOptions,
} from "@/lib/dashboard";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScanTrendsCard } from "@/components/dashboard/scan-trends-card";
import { CustomerGrowthCard } from "@/components/dashboard/customer-growth-card";
import { TopProductsCard } from "@/components/dashboard/top-products-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { IntentSectionsCard } from "@/components/dashboard/intent-sections-card";
import { SignalContributionsCard } from "@/components/dashboard/signal-contributions-card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tag" },
      {
        name: "description",
        content:
          "Executive overview of in-store scans, customer engagement, WhatsApps and recovered revenue.",
      },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(dashboardOverviewQueryOptions),
      context.queryClient.ensureQueryData(advancedAnalyticsQueryOptions(30)),
    ]),
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
  const [days, setDays] = useState(30);
  const { data } = useSuspenseQuery(dashboardOverviewQueryOptions);
  const analyticsQuery = useQuery(advancedAnalyticsQueryOptions(days));
  const analytics = analyticsQuery.data;
  const { profile, user } = useAuth();
  const k = data.kpis;

  const dailySpark = data.scansDaily.slice(-7).map((d) => ({ v: d.count }));
  const growthSpark = data.customerGrowth.slice(-7).map((d) => ({ v: d.total }));
  const notifSpark = data.notificationPerf.slice(-7).map((d) => ({ v: d.sent }));
  const readSpark = data.notificationPerf.slice(-7).map((d) => ({ v: d.read }));

  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const fullName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "there";
  const firstName = fullName.split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function exportXLSX() {
    if (!analytics) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        analytics.popularProducts.map((p: any) => ({
          Product: p.product?.name,
          Scans: p.count,
        })),
      ),
      "Top Products",
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.scanTrend), "Scan Trend");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.customerGrowth), "Customer Growth");
    const blob = new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "tag-dashboard.xlsx");
  }

  async function exportPDF() {
    if (!analytics) return;
    const t = analytics.totals;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    page.drawText("Tag — Dashboard report", { x: 40, y, size: 20, font: bold, color: rgb(0.012, 0.11, 0.302) });
    y -= 20;
    page.drawText(`Last ${days} days`, { x: 40, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 30;
    const lines = [
      `Total scans: ${t.totalScans}`,
      `Unique customers: ${t.uniqueCustomers}`,
      `Returning customers: ${t.returningCustomers}`,
      `Recovered revenue: ${currencyFmt(t.recoveredCents, t.currency)}`,
      `Avg recovery time: ${t.avgRecoveryHours.toFixed(1)} h`,
      `WhatsApp CTR: ${t.overallCtr}%`,
      `Total customers: ${t.customersTotal}`,
    ];
    for (const l of lines) {
      page.drawText(l, { x: 40, y, size: 12, font });
      y -= 18;
    }
    const bytes = await pdf.save();
    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    downloadBlob(new Blob([buf], { type: "application/pdf" }), "tag-dashboard.pdf");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good ${partOfDay}, ${firstName} 👋`}
        description={`${today} · Here's what's happening across your stores today.`}
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <TabsList>
                <TabsTrigger value="7">7d</TabsTrigger>
                <TabsTrigger value="30">30d</TabsTrigger>
                <TabsTrigger value="90">90d</TabsTrigger>
              </TabsList>
            </Tabs>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={exportXLSX}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportPDF}>
                  <FileText className="mr-2 h-4 w-4" />PDF report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
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
          label="WhatsApps sent (14d)"
          value={k.notificationsSent}
          icon={Send}
          sparkline={notifSpark}
        />
        <KpiCard
          index={4}
          label="WhatsApp conversion"
          value={k.notificationConversionPct}
          formatted={`${k.notificationConversionPct}%`}
          icon={MousePointerClick}
          tone="success"
          sparkline={readSpark}
        />
        {analytics && (
          <>
            <KpiCard
              index={5}
              label="Unique customers"
              value={analytics.totals.uniqueCustomers}
              icon={Users}
            />
            <KpiCard
              index={6}
              label="Returning customers"
              value={analytics.totals.returningCustomers}
              icon={UserCheck}
            />
            <KpiCard
              index={7}
              label="Avg recovery time"
              value={analytics.totals.avgRecoveryHours}
              formatted={`${analytics.totals.avgRecoveryHours.toFixed(1)}h`}
              icon={Clock}
            />
            <KpiCard
              index={8}
              label="Total customers"
              value={analytics.totals.customersTotal}
              icon={UsersRound}
            />
          </>
        )}
      </div>

      <SignalContributionsCard />

      <IntentSectionsCard />

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
        {analytics ? (
          <PopularStoresCard stores={analytics.popularStores} />
        ) : (
          <Skeleton className="h-72 rounded-2xl" />
        )}
      </div>

      {analytics ? (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Scan heatmap (weekday × hour)</h3>
          <Heatmap data={analytics.heatmap} />
        </Card>
      ) : null}

      <RecentActivityCard items={data.recentActivity} />
    </div>
  );
}

function PopularStoresCard({ stores }: { stores: { id: string; count: number; store?: { name?: string } | null }[] }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Popular stores</h3>
      <div className="space-y-2">
        {stores.length === 0 && (
          <p className="text-sm text-muted-foreground">No store data yet.</p>
        )}
        {stores.map((s) => {
          const max = stores[0]?.count || 1;
          const pct = (s.count / max) * 100;
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{s.store?.name ?? "—"}</span>
                <span className="tabular-nums text-muted-foreground">{s.count}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Heatmap({ data }: { data: number[][] }) {
  const max = useMemo(() => Math.max(1, ...data.flat()), [data]);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div className="grid grid-cols-[40px_repeat(24,_minmax(14px,1fr))] gap-0.5 text-[10px]">
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-center text-muted-foreground">{h % 3 === 0 ? h : ""}</div>
          ))}
          {data.map((row, d) => (
            <div key={`row-${d}`} className="contents">
              <div className="text-muted-foreground self-center">{days[d]}</div>
              {row.map((v, h) => {
                const op = v / max;
                return (
                  <div
                    key={`${d}-${h}`}
                    title={`${days[d]} ${h}:00 — ${v} scans`}
                    className="aspect-square rounded-sm"
                    style={{ backgroundColor: `rgba(3, 28, 77, ${0.08 + op * 0.85})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
