import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getAdvancedAnalytics } from "@/lib/analytics.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Tag" }] }),
  component: AnalyticsPage,
});

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const fn = useServerFn(getAdvancedAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["advanced-analytics", days],
    queryFn: () => fn({ data: { days } }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Analytics" description="Deep performance metrics across your retail network." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const analytics = data;
  const t = analytics.totals;

  function exportCSV() {
    const rows = analytics.campaignPerformance.map((c) => ({

      Campaign: c.title, Type: c.type, Sent: c.sent, Delivered: c.delivered, Read: c.read, Clicked: c.clicked, Redeemed: c.redeemed, CTR: `${c.ctr}%`,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    downloadBlob(new Blob([csv], { type: "text/csv" }), "campaigns.csv");
  }
  function exportXLSX() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.campaignPerformance), "Campaigns");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.popularProducts.map((p) => ({ Product: p.product?.name, Scans: p.count }))), "Top Products");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.scanTrend), "Scan Trend");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.customerGrowth), "Customer Growth");
    const blob = new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "tag-analytics.xlsx");
  }
  async function exportPDF() {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    page.drawText("Tag — Analytics report", { x: 40, y, size: 20, font: bold, color: rgb(0.012, 0.11, 0.302) });
    y -= 20;
    page.drawText(`Last ${days} days`, { x: 40, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 30;
    const lines = [
      `Total scans: ${t.totalScans}`,
      `Unique customers: ${t.uniqueCustomers}`,
      `Returning customers: ${t.returningCustomers}`,
      `Recovered revenue: ${formatCurrency(t.recoveredCents, t.currency)}`,
      `Avg recovery time: ${t.avgRecoveryHours.toFixed(1)} h`,
      `Notification CTR: ${t.overallCtr}%`,
      `Total customers: ${t.customersTotal}`,
    ];
    for (const l of lines) {
      page.drawText(l, { x: 40, y, size: 12, font });
      y -= 18;
    }
    y -= 12;
    page.drawText("Top campaigns", { x: 40, y, size: 14, font: bold });
    y -= 18;
    for (const c of analytics.campaignPerformance.slice(0, 10)) {
      page.drawText(`${c.title.slice(0, 40)}  —  sent ${c.sent}, clicked ${c.clicked}, ctr ${c.ctr}%`, { x: 40, y, size: 10, font });
      y -= 14;
      if (y < 60) break;
    }
    const bytes = await pdf.save();
    // pdf-lib returns a Uint8Array; wrap in a fresh ArrayBuffer copy so the Blob ctor types are satisfied
    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    downloadBlob(new Blob([buf], { type: "application/pdf" }), "tag-analytics.pdf");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Deep performance metrics across your retail network."
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
                <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={exportCSV}><FileSpreadsheet className="mr-2 h-4 w-4" />CSV</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportXLSX}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportPDF}><FileText className="mr-2 h-4 w-4" />PDF report</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total scans" value={t.totalScans.toLocaleString()} />
        <Kpi label="Unique customers" value={t.uniqueCustomers.toLocaleString()} />
        <Kpi label="Returning customers" value={t.returningCustomers.toLocaleString()} />
        <Kpi label="Recovered revenue" value={formatCurrency(t.recoveredCents, t.currency)} tone="success" />
        <Kpi label="Avg recovery time" value={`${t.avgRecoveryHours.toFixed(1)}h`} />
        <Kpi label="Notification CTR" value={`${t.overallCtr}%`} />
        <Kpi label="Total customers" value={t.customersTotal.toLocaleString()} />
        <Kpi label="Active campaigns" value={analytics.campaignPerformance.length.toString()} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Scan trend</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.scanTrend}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Area type="monotone" dataKey="scans" stroke="hsl(var(--primary))" fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Customer growth</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.customerGrowth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="new" stroke="var(--success)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Popular products</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.popularProducts.map((p) => ({ name: p.product?.name?.slice(0, 16) ?? "—", scans: p.count }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={10} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="scans" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Popular stores</h3>
          <div className="space-y-2">
            {analytics.popularStores.length === 0 && <p className="text-sm text-muted-foreground">No store data yet.</p>}
            {analytics.popularStores.map((s) => {
              const max = analytics.popularStores[0]?.count || 1;
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
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Scan heatmap (weekday × hour)</h3>
        <Heatmap data={analytics.heatmap} />
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Campaign performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2">Campaign</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-right py-2 px-2">Sent</th>
                <th className="text-right py-2 px-2">Delivered</th>
                <th className="text-right py-2 px-2">Read</th>
                <th className="text-right py-2 px-2">Clicked</th>
                <th className="text-right py-2 px-2">Redeemed</th>
                <th className="text-right py-2 px-2">CTR</th>
              </tr>
            </thead>
            <tbody>
              {analytics.campaignPerformance.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No campaigns yet.</td></tr>
              )}
              {analytics.campaignPerformance.map((c) => (
                <tr key={c.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 px-2 font-medium">{c.title}</td>
                  <td className="py-2 px-2"><Badge variant="secondary" className="text-[10px]">{c.type}</Badge></td>
                  <td className="py-2 px-2 text-right tabular-nums">{c.sent}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{c.delivered}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{c.read}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{c.clicked}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{c.redeemed}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-medium">{c.ctr}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone === "success" ? "text-[color:var(--success)]" : ""}`}>{value}</p>
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
            <>
              <div key={`l-${d}`} className="text-muted-foreground self-center">{days[d]}</div>
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
            </>
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
