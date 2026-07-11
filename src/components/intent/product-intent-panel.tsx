import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IntentBadge, type IntentTrend } from "@/components/intent/intent-badge";
import { getProductIntent, getRetailerIntentOverview, recomputeProductIntentFn } from "@/lib/intent.functions";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceDot,
} from "recharts";

type Breakdown = { label: string; val: number };
type Forecast = { predicted_score_7d: number; predicted_score_14d: number; predicted_trend: string } | null | undefined;
type HistoryPoint = { date: string; score: number; forecast?: boolean };

function asTrend(v: unknown): IntentTrend {
  return v === "rising" || v === "falling" ? v : "stable";
}

function clampPct(n: any) {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function buildChartData(history: Array<{ snapshot_date: string; intent_score: number }>, forecast: Forecast): HistoryPoint[] {
  const points: HistoryPoint[] = history.map((h) => ({ date: h.snapshot_date, score: Number(h.intent_score) }));
  if (forecast?.predicted_score_7d != null) {
    const lastDate = points.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
    const d7 = new Date(lastDate); d7.setDate(d7.getDate() + 7);
    const d14 = new Date(lastDate); d14.setDate(d14.getDate() + 14);
    points.push({ date: d7.toISOString().slice(0, 10), score: Number(forecast.predicted_score_7d), forecast: true });
    points.push({ date: d14.toISOString().slice(0, 10), score: Number(forecast.predicted_score_14d), forecast: true });
  }
  return points;
}

function signalBreakdown(sig: any): Breakdown[] {
  return [
    { label: "Scans", val: clampPct(sig.scans_total / 50) },
    { label: "Repeat scans", val: clampPct(sig.repeat_scans / 30) },
    { label: "Time on page", val: clampPct((sig.avg_time_on_page_seconds ?? 0) / 120) },
    { label: "Unique viewers", val: clampPct(sig.viewers / 40) },
    { label: "Watchlist", val: clampPct(sig.watchlist_adds / 25) },
    { label: "Notif engagement", val: clampPct(sig.notif_engagement / 30) },
    { label: "Conversion rate", val: clampPct(sig.conversion_rate) },
    { label: "Cart rate", val: clampPct(sig.add_to_cart_rate) },
    { label: "Price impact", val: clampPct(sig.price_impact) },
  ];
}

function IntentScoreCard({
  title,
  description,
  score,
  confidence,
  trend,
  breakdown,
  forecast,
  chartData,
  insight,
  onRecompute,
  recomputing,
}: {
  title: string;
  description: string;
  score: number;
  confidence: number;
  trend: IntentTrend;
  breakdown: Breakdown[];
  forecast: Forecast;
  chartData: HistoryPoint[];
  insight: string;
  onRecompute?: () => void;
  recomputing?: boolean;
}) {
  const TrendIcon = trend === "rising" ? TrendingUp : trend === "falling" ? TrendingDown : Minus;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {onRecompute && (
          <Button size="sm" variant="outline" onClick={onRecompute} disabled={recomputing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recomputing ? "animate-spin" : ""}`} />
            Recompute
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-5xl font-bold tabular-nums leading-none">
              {Math.round(score)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">out of 100</div>
          </div>
          <div className="space-y-2">
            <IntentBadge score={score} trend={trend} confidence={confidence} size="lg" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon className="h-3 w-3" />
              <span className="capitalize">{trend}</span>
              <span>·</span>
              <span>confidence {(confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          {forecast?.predicted_trend && (
            <div className="ml-auto rounded-lg border p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Forecast</div>
              <div className="font-semibold">7-day: {Math.round(forecast.predicted_score_7d)} · 14-day: {Math.round(forecast.predicted_score_14d)}</div>
              <div className="text-xs text-muted-foreground capitalize">Trend: {forecast.predicted_trend}</div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Insight</div>
          {insight}
        </div>

        <div>
          <div className="text-sm font-medium mb-3">Signal contributions</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {breakdown.map((b) => (
              <div key={b.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="tabular-nums">{Math.round(b.val * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${b.val * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Demand forecast</div>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="intentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#intentGrad)" strokeWidth={2} />
                <ReferenceLine y={70} stroke="hsl(var(--success, 142 71% 45%))" strokeDasharray="4 4" />
                <ReferenceLine y={40} stroke="hsl(var(--warning, 30 100% 55%))" strokeDasharray="4 4" />
                {chartData.at(-1) && (
                  <ReferenceDot x={chartData.at(-1)!.date} y={chartData.at(-1)!.score as number} r={4} fill="hsl(var(--primary))" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductIntentPanel({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["intent", "product", productId],
    queryFn: () => getProductIntent({ data: { product_id: productId } }),
  });

  const recompute = useMutation({
    mutationFn: () => recomputeProductIntentFn({ data: { product_id: productId } }),
    onSuccess: () => {
      toast.success("Intent score recomputed");
      qc.invalidateQueries({ queryKey: ["intent", "product", productId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading || !data?.product) {
    return <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>;
  }

  const p = data.product as any;
  const sig = (data.signals ?? {}) as any;
  const fc = (data.forecast ?? {}) as any;
  const history = (data.history ?? []).map((h: any) => ({ snapshot_date: h.snapshot_date, intent_score: h.intent_score }));

  return (
    <IntentScoreCard
      title="Intent Score"
      description="Aggregated demand signal · updates in real time."
      score={Number(p.intent_score)}
      confidence={Number(p.intent_score_confidence)}
      trend={asTrend(p.intent_score_trend)}
      breakdown={signalBreakdown(sig)}
      forecast={fc?.predicted_trend ? fc : null}
      chartData={buildChartData(history, fc?.predicted_trend ? fc : null)}
      insight={generateProductInsight(p, sig, fc)}
      onRecompute={() => recompute.mutate()}
      recomputing={recompute.isPending}
    />
  );
}

export function OverallIntentCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["intent", "overview"],
    queryFn: () => getRetailerIntentOverview(),
  });

  if (isLoading || !data) {
    return <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>;
  }

  const o = data.overview;
  const forecast = data.forecast ?? null;

  return (
    <IntentScoreCard
      title="Intent Score"
      description={`Overall demand signal across ${data.productCount} product${data.productCount === 1 ? "" : "s"}.`}
      score={Number(o.intent_score)}
      confidence={Number(o.intent_score_confidence)}
      trend={asTrend(o.intent_score_trend)}
      breakdown={signalBreakdown(data.signals)}
      forecast={forecast}
      chartData={buildChartData(data.history, forecast)}
      insight={generateOverviewInsight(data)}
    />
  );
}

function generateProductInsight(p: any, sig: any, fc: any): string {
  const score = Number(p.intent_score);
  const conv = Number(sig.conversion_rate ?? 0);
  const stock = Number(p.stock_qty ?? 0);
  const lowStock = stock <= Number(p.low_stock_threshold ?? 0);
  if (score >= 70 && conv < 0.02) return "High engagement but low conversion — review pricing or product page.";
  if (sig.repeat_scans > 5) return "Strong repeat scans suggest comparison shopping behaviour.";
  if (score >= 70 && lowStock) return "High intent with low stock — urgent replenishment risk.";
  if (fc?.predicted_trend === "increase" && lowStock) return "Forecast shows rising demand — consider stock increase.";
  if (fc?.predicted_trend === "decrease") return "Declining intent — possible product fatigue. Test a refresh or promotion.";
  if (score < 30) return "Very low intent. Slow mover — consider a discount, bundle or rotation.";
  return "Performance is steady. Monitor the forecast and conversion rate.";
}

function generateOverviewInsight(data: {
  productCount: number;
  risingCount: number;
  fallingCount: number;
  lowStockCount: number;
  overview: { intent_score: number };
  forecast?: { predicted_trend: string } | null;
}): string {
  const { productCount, risingCount, fallingCount, lowStockCount, overview, forecast } = data;
  if (productCount === 0) return "No products yet — scores will appear once your catalogue is populated.";
  if (overview.intent_score >= 70 && lowStockCount > 0) {
    return `Demand is strong and ${lowStockCount} product${lowStockCount === 1 ? " is" : "s are"} low on stock — check replenishment priorities.`;
  }
  if (forecast?.predicted_trend === "decrease") return "Overall demand is forecast to soften — review your slow movers.";
  if (risingCount > fallingCount && risingCount > 0) return `${risingCount} product${risingCount === 1 ? "" : "s"} trending up — worth featuring in WhatsApp or in-store promotion.`;
  if (fallingCount > risingCount && fallingCount > 0) return `${fallingCount} product${fallingCount === 1 ? "" : "s"} losing intent — consider a refresh or discount.`;
  return "Demand is steady across the catalogue. Monitor the forecast and conversion rate.";
}
