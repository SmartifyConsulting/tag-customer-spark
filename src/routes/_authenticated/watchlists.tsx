import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, Pause, Play, Send, Bell, ArrowUpRight, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listWatchlists, getWatchlistOverview, triggerWatchlistNow, updateWatchlistStatus,
} from "@/lib/watchlists.functions";

export const Route = createFileRoute("/_authenticated/watchlists")({
  head: () => ({ meta: [{ title: "Watchlists — Tag" }] }),
  component: WatchlistsPage,
});

const TRIGGER_LABEL: Record<string, string> = {
  on_sale: "On sale",
  back_in_stock: "Back in stock",
  low_stock: "Low stock",
  price_drop_below: "Price drop",
  any_update: "Any update",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  fired: "secondary",
  paused: "outline",
  expired: "outline",
  cancelled: "outline",
};

function money(c?: number | null) {
  if (c == null) return "—";
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(c / 100);
}

function WatchlistsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | "active" | "paused" | "fired" | "expired" | "cancelled">("all");
  const [trigger, setTrigger] = useState<string>("all");
  const [search, setSearch] = useState("");

  const overview = useQuery({ queryKey: ["wl", "overview"], queryFn: () => getWatchlistOverview() });
  const list = useQuery({
    queryKey: ["wl", "list", status, trigger, search],
    queryFn: () => listWatchlists({ data: { status, trigger: trigger === "all" ? undefined : trigger, search } }),
  });

  const fire = useMutation({
    mutationFn: (id: string) => triggerWatchlistNow({ data: { id } }),
    onSuccess: () => { toast.success("Watchlist event sent"); qc.invalidateQueries({ queryKey: ["wl"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const setStatusMut = useMutation({
    mutationFn: (v: { id: string; status: "active" | "paused" | "cancelled" }) => updateWatchlistStatus({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["wl"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Watchlists"
        description="Every customer who asked to be notified when something changes — price drops, restocks, promotions."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active watchers", value: overview.data?.conversion.active ?? 0, hint: "currently waiting", icon: Eye },
          { label: "Fired this period", value: overview.data?.conversion.fired ?? 0, hint: "notifications triggered", icon: Bell },
          { label: "Sales recovered", value: overview.data?.conversion.recovered ?? 0, hint: "attributed to watchlists", icon: ArrowUpRight },
        ].map((k) => (
          <Card key={k.label} className="rounded-2xl">
            <CardContent className="flex items-start gap-3 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold tracking-tight">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All watchlists</CardTitle>
              <CardDescription>Filter by status or trigger to focus on what matters now.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search product or customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-56"
              />
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Trigger" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All triggers</SelectItem>
                  {Object.entries(TRIGGER_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={status} onValueChange={(v) => setStatus(v as any)} className="px-6 pt-2">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="paused">Paused</TabsTrigger>
                <TabsTrigger value="fired">Fired</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="divide-y">
              {list.isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (list.data?.rows ?? []).length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Eye} title="No watchlists yet" description="When customers ask to be notified, they'll appear here." />
                </div>
              ) : list.data!.rows.map((w: any) => (
                <div key={w.id} className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-[1.5fr_1fr_auto] sm:items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    {w.product?.image_url ? (
                      <img src={w.product.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{w.product?.name ?? "Product"}</p>
                      <p className="truncate text-xs text-muted-foreground">{w.customer?.full_name} · {w.customer?.whatsapp_e164}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={w.trigger === "back_in_stock" ? "border-transparent bg-sky-200 text-sky-900" : ""}
                    >
                      {TRIGGER_LABEL[w.trigger] ?? w.trigger}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[w.status] ?? "outline"}>{w.status}</Badge>
                    {w.target_price_cents && <span className="text-xs text-muted-foreground">Target {money(w.target_price_cents)}</span>}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => fire.mutate(w.id)} disabled={fire.isPending}>
                      <Send className="mr-1 h-3.5 w-3.5" /> Notify
                    </Button>
                    {w.status === "active" ? (
                      <Button size="sm" variant="ghost" onClick={() => setStatusMut.mutate({ id: w.id, status: "paused" })}>
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatusMut.mutate({ id: w.id, status: "active" })}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setStatusMut.mutate({ id: w.id, status: "cancelled" })}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Most-watched products</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(overview.data?.topProducts ?? []).length === 0 ? (
                <EmptyState icon={Eye} title="No watchers yet" />
              ) : overview.data!.topProducts.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3">
                  {p.image_url ? <img src={p.image_url} className="h-9 w-9 rounded-md object-cover" /> : <div className="h-9 w-9 rounded-md bg-muted" />}
                  <p className="flex-1 truncate text-sm">{p.name}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{p.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Recent fires</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(overview.data?.recentEvents ?? []).length === 0 ? (
                <EmptyState icon={Bell} title="No events yet" />
              ) : overview.data!.recentEvents.map((e: any) => (
                <div key={e.id} className="text-sm">
                  <p className="font-medium">{e.watchlist?.product?.name ?? "Product"}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.watchlist?.customer?.full_name} · {TRIGGER_LABEL[e.trigger] ?? e.trigger} · {new Date(e.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
