import { createFileRoute } from "@tanstack/react-router";
import { requireFeature } from "@/lib/tier-guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TrendingUp, DollarSign, Target, Layers, Sparkles, RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { EmptyState } from "@/components/empty-state";
import {
  getRoiOverview, getRoiSettings, updateRoiSettings, runAttributionSweep,
} from "@/lib/roi.functions";

export const Route = createFileRoute("/_authenticated/roi")({
  head: () => ({ meta: [{ title: "ROI Engine — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "roi"),
  component: RoiPage,
});

function money(c: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 0 }).format((c ?? 0) / 100);
}

function RoiPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);

  const overview = useQuery({ queryKey: ["roi", "overview", days], queryFn: () => getRoiOverview({ data: { days } }) });
  const settings = useQuery({ queryKey: ["roi", "settings"], queryFn: () => getRoiSettings() });

  const sweep = useMutation({
    mutationFn: () => runAttributionSweep(),
    onSuccess: (r: any) => { toast.success(`Attribution sweep: ${r.inserted} new`); qc.invalidateQueries({ queryKey: ["roi"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const k = overview.data?.kpis;
  const currency = overview.data?.currency ?? "ZAR";

  return (
    <div className="space-y-8">
      <PageHeader
        title="ROI Engine"
        description="Attribute revenue to scans, watchlists, and notifications — and prove the platform's value to your CFO."
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={String(days)} onValueChange={(v) => setDays(parseInt(v))}>
              <TabsList>
                <TabsTrigger value="7">7d</TabsTrigger>
                <TabsTrigger value="30">30d</TabsTrigger>
                <TabsTrigger value="90">90d</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => sweep.mutate()} disabled={sweep.isPending}>
              <RefreshCw className={"mr-1 h-4 w-4 " + (sweep.isPending ? "animate-spin" : "")} /> Run sweep
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overview.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />) : (
          <>
            <KpiTile icon={DollarSign} label="Recovered revenue" value={money(k?.revenue ?? 0, currency)} hint={`${k?.recovered ?? 0} sales attributed`} />
            <KpiTile icon={TrendingUp} label="ROI multiple" value={`${(k?.roi ?? 0).toFixed(1)}×`} hint={`Cost ${money(k?.cost ?? 0, currency)}`} tone="success" />
            <KpiTile icon={Target} label="Gross margin" value={money(k?.margin ?? 0, currency)} hint="After default margin %" />
            <KpiTile icon={Layers} label="Cost per recovery" value={money(k?.costPerSale ?? 0, currency)} hint={`Payback ${((k?.payback ?? 0) * 100).toFixed(1)}%`} />
          </>
        )}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Revenue vs. cost</CardTitle>
          <CardDescription>Attributed revenue compared to messaging cost over the selected window.</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.isLoading ? <Skeleton className="h-64 w-full" /> : (overview.data?.series ?? []).length === 0 ? (
            <EmptyState icon={DollarSign} title="No attributed sales yet" description="Once notifications convert, ROI will appear here. Try running the sweep." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <AreaChart data={overview.data!.series.map(s => ({ ...s, revenue: s.revenue / 100, cost: s.cost / 100 }))}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cost" stroke="hsl(var(--destructive))" fillOpacity={0} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>By channel</CardTitle><CardDescription>Where recovered revenue is coming from.</CardDescription></CardHeader>
          <CardContent>
            {(overview.data?.byChannel ?? []).length === 0 ? <EmptyState icon={Sparkles} title="Nothing to compare yet" /> : (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={overview.data!.byChannel.map(c => ({ ...c, revenue: c.revenue / 100 }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Top campaigns</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(overview.data?.byCampaign ?? []).length === 0 ? <EmptyState icon={Sparkles} title="No campaigns attributed yet" /> :
              overview.data!.byCampaign.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.type} · {c.count} sales</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{money(c.revenue, currency)}</p>
                    <p className="text-xs text-muted-foreground">ROI {c.cost > 0 ? (c.revenue / c.cost).toFixed(1) : "∞"}×</p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <RoiSettingsCard data={settings.data} onSaved={() => qc.invalidateQueries({ queryKey: ["roi"] })} />
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, hint, tone }: any) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-start gap-3 p-5">
        <div className={"grid h-10 w-10 place-items-center rounded-xl " + (tone === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RoiSettingsCard({ data, onSaved }: { data: any; onSaved: () => void }) {
  const [form, setForm] = useState<any>(null);
  const current = form ?? data;

  const save = useMutation({
    mutationFn: () => updateRoiSettings({
      data: {
        attribution_window_hours: current.attribution_window_hours,
        cost_per_message_cents: current.cost_per_message_cents,
        default_margin_pct: Number(current.default_margin_pct),
        currency: current.currency,
        model: current.model,
      },
    }),
    onSuccess: () => { toast.success("ROI settings saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!current) return null;
  const patch = (p: any) => setForm({ ...current, ...p });

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Attribution settings</CardTitle>
        <CardDescription>Tune how Tag credits revenue to scans, watchlists, and campaigns.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Attribution window (hours)</Label>
          <div className="flex items-center gap-4">
            <Slider value={[current.attribution_window_hours]} min={1} max={720} step={1} onValueChange={(v) => patch({ attribution_window_hours: v[0] })} />
            <span className="w-16 text-right text-sm tabular-nums">{current.attribution_window_hours}h</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cost per message (cents)</Label>
          <Input type="number" value={current.cost_per_message_cents} onChange={(e) => patch({ cost_per_message_cents: parseInt(e.target.value || "0") })} />
        </div>
        <div className="space-y-2">
          <Label>Default margin (0–1)</Label>
          <Input type="number" step="0.01" value={current.default_margin_pct} onChange={(e) => patch({ default_margin_pct: parseFloat(e.target.value || "0") })} />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Input value={current.currency} maxLength={3} onChange={(e) => patch({ currency: e.target.value.toUpperCase() })} />
        </div>
        <div className="space-y-2">
          <Label>Attribution model</Label>
          <Select value={current.model} onValueChange={(v) => patch({ model: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last_touch">Last touch</SelectItem>
              <SelectItem value="first_touch">First touch</SelectItem>
              <SelectItem value="linear">Linear</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}
