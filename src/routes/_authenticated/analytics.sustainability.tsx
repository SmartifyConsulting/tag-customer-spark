import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  Coins,
  Download,
  FileText,
  Info,
  Leaf,
  Recycle,
  Sparkles,
  Trees,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { IntelligenceTabs } from "@/components/intelligence-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiveImpactBanner } from "@/components/sustainability/live-impact-banner";
import { SustainabilityConfigDialog } from "@/components/sustainability/config-dialog";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/format";
import { exportCsv, exportExcel, exportTablePdf } from "@/components/ownership/export";
import { useIsAdmin } from "@/hooks/use-auth";
import {
  SUSTAINABILITY_PERIODS,
  bandColour,
  formatKg,
  formatLitres,
  formatMetres,
  sustainabilityInsightsQueryOptions,
  sustainabilityOverviewQueryOptions,
  sustainabilitySettingsQueryOptions,
  type SustainabilityPeriodKey,
  type SustainabilityStoreRow,
} from "@/lib/sustainability";
import { getSustainabilitySettings } from "@/lib/sustainability.functions";

export const Route = createFileRoute("/_authenticated/analytics/sustainability")({
  head: () => ({
    meta: [
      { title: "Sustainability Impact — TAG Retail" },
      {
        name: "description",
        content:
          "ESG dashboard quantifying paper receipts avoided, CO₂e, water and cost saved through TAG digital receipts.",
      },
      { property: "og:title", content: "Sustainability Impact — TAG Retail" },
      {
        property: "og:description",
        content: "Digital receipt adoption, paper avoided and ESG reporting metrics for your stores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    // Module switch: retailers who have turned Sustainability off should not
    // be able to reach the route directly either.
    const settings = await getSustainabilitySettings();
    if (settings && settings.enabled === false) throw redirect({ to: "/analytics" });
  },
  component: SustainabilityPage,
});

const GREEN = "#10b981";
const SLATE = "#94a3b8";

function InfoDot({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How this is calculated"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs leading-relaxed">{text}</PopoverContent>
    </Popover>
  );
}

function StatRow({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {label}
        {help && <InfoDot text={help} />}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function SustainabilityPage() {
  const isAdmin = useIsAdmin();
  const [period, setPeriod] = useState<SustainabilityPeriodKey>("since");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<"adoptionPct" | "paperSavedKg" | "score">("adoptionPct");
  const [activeStore, setActiveStore] = useState<SustainabilityStoreRow | null>(null);

  const params = useMemo(
    () => ({
      period,
      ...(period === "custom" && from ? { from } : {}),
      ...(period === "custom" && to ? { to } : {}),
    }),
    [period, from, to],
  );

  const settings = useQuery(sustainabilitySettingsQueryOptions);
  const overviewQuery = useQuery(sustainabilityOverviewQueryOptions(params));
  const insightsQuery = useQuery({
    ...sustainabilityInsightsQueryOptions(params),
    enabled: !!overviewQuery.data?.hasRetailerContext,
  });
  const d = overviewQuery.data;
  const currency = d?.currency ?? "ZAR";

  const sortedStores = useMemo(() => {
    if (!d) return [];
    return [...d.stores].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [d, sortKey]);

  const esgRows = () =>
    d
      ? [
          { Metric: "Digital receipts issued", Value: d.receipts.total },
          { Metric: "Paper receipts avoided", Value: d.paper.receiptsAvoided },
          { Metric: "Receipt roll avoided (m)", Value: d.paper.metres },
          { Metric: "Thermal paper eliminated (kg)", Value: d.paper.kilograms },
          { Metric: "CO2e avoided (kg)", Value: d.environment.co2Kg },
          { Metric: "Water saved (litres)", Value: d.environment.waterLitres },
          { Metric: "Energy saved (kWh)", Value: d.environment.energyKwh },
          { Metric: `Cost saved (${currency})`, Value: (d.cost.totalCents / 100).toFixed(2) },
          { Metric: "Reporting period", Value: d.periodLabel },
        ]
      : [];

  if (settings.data && settings.data.enabled === false) {
    return (
      <EmptyState
        icon={Leaf}
        title="Sustainability module is switched off"
        description="An administrator can switch it back on in the sustainability configuration."
      />
    );
  }

  return (
    <div className="space-y-6">
      <IntelligenceTabs />
      <PageHeader
        title="Sustainability Impact"
        description="Environmental and cost impact of replacing printed till slips with TAG digital receipts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as SustainabilityPeriodKey)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUSTAINABILITY_PERIODS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {period === "custom" && (
              <>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
              </>
            )}
            {isAdmin && <SustainabilityConfigDialog />}
          </div>
        }
      />

      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Reporting period
          </p>
          <p className="text-sm font-semibold">{d?.periodLabel ?? "—"}</p>
        </div>
        {d?.demo && (
          <Badge variant="outline" className="border-amber-500 text-amber-600">
            Demo data — illustrative, not live
          </Badge>
        )}
      </div>

      {d ? (
        <LiveImpactBanner
          digitalReceipts={d.live.digitalReceipts}
          paperAvoided={d.live.paperAvoided}
          thermalPaperKg={d.live.thermalPaperKg}
          since={d.joinedAt}
        />
      ) : (
        <Skeleton className="h-28 w-full rounded-2xl" />
      )}

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={0}
            label="Digital receipts"
            value={d?.receipts.total ?? 0}
            delta={d?.receipts.growthPct}
            deltaLabel="%"
            icon={FileText}
            tone="success"
          />
          <Card className="mt-2">
            <CardContent className="p-4">
              <StatRow label="Share of transactions" value={`${d?.receipts.digitalSharePct ?? 0}%`} />
              <StatRow label="Daily average" value={`${d?.receipts.dailyAverage ?? 0}`} />
              <StatRow label="Previous period" value={(d?.receipts.previousTotal ?? 0).toLocaleString()} />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={1}
            label="Paper receipts avoided"
            value={d?.paper.receiptsAvoided ?? 0}
            icon={Recycle}
            tone="success"
          />
          <Card className="mt-2">
            <CardContent className="p-4">
              <StatRow
                label="Receipt roll avoided"
                value={formatMetres(d?.paper.metres ?? 0)}
                help="Digital receipts × average receipt length."
              />
              <StatRow
                label="Thermal paper saved"
                value={formatKg(d?.paper.kilograms ?? 0)}
                help="Digital receipts × average receipt weight."
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={2}
            label="CO₂e avoided"
            value={d?.environment.co2Kg ?? 0}
            formatted={formatKg(d?.environment.co2Kg ?? 0)}
            icon={Trees}
            tone="success"
          />
          <Card className="mt-2">
            <CardContent className="p-4">
              <StatRow
                label="Water saved"
                value={formatLitres(d?.environment.waterLitres ?? 0)}
                help="Thermal paper saved × water factor (litres per kg of paper)."
              />
              <StatRow
                label="Energy saved"
                value={`${(d?.environment.energyKwh ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh`}
                help="Printer energy per 1 000 receipts × digital receipts."
              />
              <StatRow
                label="Carbon factor"
                value={`${settings.data?.co2_kg_per_kg_paper ?? 2.4} kg/kg`}
                help="Cradle-to-gate emissions of thermal paper. Configurable."
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <KpiCard
            index={3}
            label="Cost saved"
            value={Math.round((d?.cost.totalCents ?? 0) / 100)}
            formatted={formatMoney(d?.cost.totalCents ?? 0, currency, { maximumFractionDigits: 0 })}
            icon={Coins}
          />
          <Card className="mt-2">
            <CardContent className="p-4">
              <StatRow label="Receipt paper" value={formatMoney(d?.cost.paperCents ?? 0, currency, { maximumFractionDigits: 0 })} />
              <StatRow label="Printer maintenance" value={formatMoney(d?.cost.maintenanceCents ?? 0, currency, { maximumFractionDigits: 0 })} />
              <StatRow label="Ink / ribbon" value={formatMoney(d?.cost.inkCents ?? 0, currency, { maximumFractionDigits: 0 })} />
              <StatRow
                label="Estimated annual"
                value={formatMoney(d?.cost.annualisedCents ?? 0, currency, { maximumFractionDigits: 0 })}
                help="Period saving scaled to 365 days at the current run-rate."
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Charts ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Digital receipt adoption</CardTitle>
            <CardDescription>Digital versus printed receipts over the period.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {d ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.adoptionSeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <RTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="digital" name="Digital" stroke={GREEN} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="paper" name="Paper" stroke={SLATE} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly environmental impact</CardTitle>
            <CardDescription>Paper saved, CO₂e avoided and water saved.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {d ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.monthlyImpact}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <RTooltip />
                  <Legend />
                  <Bar dataKey="paperKg" name="Paper (kg)" fill={GREEN} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="co2Kg" name="CO₂e (kg)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="waterL" name="Water (L)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Funnel + ESG summary ──────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Digital receipt adoption funnel</CardTitle>
            <CardDescription>Conversion between each stage of the journey.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(d?.funnel ?? []).map((stage, i, arr) => {
              const prev = i === 0 ? stage.value : arr[i - 1]!.value;
              const pct = prev ? (stage.value / prev) * 100 : 0;
              const width = arr[0]!.value ? (stage.value / arr[0]!.value) * 100 : 0;
              return (
                <div key={stage.stage}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{stage.stage}</span>
                    <span className="tabular-nums">
                      {stage.value.toLocaleString()}
                      {i > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                      )}
                    </span>
                  </div>
                  <Progress value={width} className="mt-1 h-2" />
                </div>
              );
            })}
            {!d && <Skeleton className="h-48 w-full" />}
          </CardContent>
        </Card>

        <Card className="col-span-12 border-emerald-200 lg:col-span-6">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <div>
              <CardTitle className="text-sm">Retailer ESG summary</CardTitle>
              <CardDescription>{d?.periodLabel}</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="mr-1.5 h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportTablePdf("TAG Sustainability ESG Summary", esgRows(), "tag-esg-summary.pdf")}>
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportExcel(esgRows(), "tag-esg-summary.xlsx", "ESG")}>
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsv(esgRows(), "tag-esg-summary.csv")}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <StatRow label="Digital receipts issued" value={(d?.receipts.total ?? 0).toLocaleString()} />
            <StatRow label="Paper receipts avoided" value={(d?.paper.receiptsAvoided ?? 0).toLocaleString()} />
            <StatRow label="Thermal paper eliminated" value={formatKg(d?.paper.kilograms ?? 0)} />
            <StatRow label="CO₂e avoided" value={formatKg(d?.environment.co2Kg ?? 0)} />
            <StatRow label="Water saved" value={formatLitres(d?.environment.waterLitres ?? 0)} />
            <StatRow label="Energy saved" value={`${(d?.environment.energyKwh ?? 0).toFixed(1)} kWh`} />
            <StatRow
              label="Cost saved"
              value={formatMoney(d?.cost.totalCents ?? 0, currency, { maximumFractionDigits: 0 })}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Store comparison + heat map ───────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
            <div>
              <CardTitle className="text-sm">Store comparison</CardTitle>
              <CardDescription>Rank stores by adoption, paper reduction or overall score.</CardDescription>
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adoptionPct">Digital adoption</SelectItem>
                <SelectItem value="paperSavedKg">Paper reduction</SelectItem>
                <SelectItem value="score">Sustainability score</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Digital</TableHead>
                  <TableHead className="text-right">Adoption</TableHead>
                  <TableHead className="text-right">Paper saved</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStores.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setActiveStore(s)}>
                    <TableCell className="font-medium">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${bandColour(s.band)}`} />
                      {s.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.transactions.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.digitalReceipts.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.adoptionPct}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKg(s.paperSavedKg)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.score}</TableCell>
                  </TableRow>
                ))}
                {!sortedStores.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No store activity in this period yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Store heat map</CardTitle>
            <CardDescription>
              <span className="mr-3"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />High</span>
              <span className="mr-3"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Medium</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Low</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(d?.stores ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStore(s)}
                  className={`rounded-xl p-3 text-left text-white transition-transform hover:scale-[1.02] ${bandColour(s.band)}`}
                >
                  <p className="truncate text-xs font-semibold">{s.name}</p>
                  <p className="text-lg font-bold tabular-nums">{s.adoptionPct}%</p>
                  <p className="text-[10px] opacity-90">{s.digitalReceipts.toLocaleString()} digital</p>
                </button>
              ))}
              {!d?.stores.length && (
                <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                  No stores to show yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Consumer impact + leaderboards ────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Consumer impact</CardTitle>
            <CardDescription>How shoppers are participating.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatRow label="Customers participating" value={(d?.consumers.participating ?? 0).toLocaleString()} />
            <StatRow label="Avg receipts per customer" value={`${d?.consumers.avgReceiptsPerCustomer ?? 0}`} />
            <StatRow label="Using automatic Wallet ID" value={`${d?.consumers.autoWalletPct ?? 0}%`} />
            <StatRow
              label="Avg paper saved per customer"
              value={`${(d?.consumers.avgPaperSavedGrams ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} g`}
            />
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Award className="h-4 w-4 text-emerald-600" /> Leaderboards
            </CardTitle>
            <CardDescription>Top performers for the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { title: "Top performing stores", rows: d?.leaderboards.stores },
              { title: "Top cashiers", rows: d?.leaderboards.cashiers },
              { title: "Top regions", rows: d?.leaderboards.regions },
              { title: "Highest customer adoption", rows: d?.leaderboards.adoption },
              { title: "Most paper saved", rows: d?.leaderboards.paper },
            ].map((board) => (
              <div key={board.title}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {board.title}
                </p>
                {(board.rows ?? []).length ? (
                  <ol className="space-y-1">
                    {(board.rows ?? []).map((r, i) => (
                      <li key={r.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          <span className="mr-1.5 text-xs text-muted-foreground">{i + 1}.</span>
                          {r.name}
                        </span>
                        <span className="shrink-0 tabular-nums font-medium">
                          {r.value.toLocaleString()} {r.unit === "%" ? "%" : r.unit}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-muted-foreground">No data yet.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── AI insights ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-emerald-600" /> AI executive observations
          </CardTitle>
          <CardDescription>Generated from this period's adoption and impact data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {insightsQuery.isLoading && <Skeleton className="h-24 w-full sm:col-span-2" />}
          {(insightsQuery.data?.insights ?? []).map((ins) => (
            <div key={ins.title} className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3">
              <p className="text-sm font-semibold text-emerald-900">{ins.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">{ins.detail}</p>
            </div>
          ))}
          {!insightsQuery.isLoading && !(insightsQuery.data?.insights ?? []).length && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Not enough activity yet to generate observations.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Store detail ──────────────────────────────────────────── */}
      <Dialog open={!!activeStore} onOpenChange={(o) => !o && setActiveStore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeStore?.name}</DialogTitle>
            <DialogDescription>
              {[activeStore?.city, activeStore?.province].filter(Boolean).join(", ") || "Store sustainability detail"}
            </DialogDescription>
          </DialogHeader>
          {activeStore && (
            <div className="space-y-1">
              <StatRow label="Transactions" value={activeStore.transactions.toLocaleString()} />
              <StatRow label="Digital receipts" value={activeStore.digitalReceipts.toLocaleString()} />
              <StatRow label="Digital adoption" value={`${activeStore.adoptionPct}%`} />
              <StatRow label="Thermal paper saved" value={formatKg(activeStore.paperSavedKg)} />
              <StatRow label="CO₂e avoided" value={formatKg(activeStore.co2Kg)} />
              <StatRow label="Sustainability score" value={String(activeStore.score)} />
              <Progress value={activeStore.adoptionPct} className="mt-3 h-2" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
