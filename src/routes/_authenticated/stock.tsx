import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Boxes, AlertTriangle, PackageX, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { listStockOverview, updateStock } from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Stock — Tag" }] }),
  component: StockPage,
});

type Filter = "all" | "low" | "out";

function StockPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["stock", filter],
    queryFn: () => listStockOverview({ data: { filter } }),
  });

  const rows = (q.data ?? []).filter((p: any) =>
    !search
      ? true
      : (p.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    total: q.data?.length ?? 0,
    low:
      q.data?.filter(
        (p: any) =>
          (p.stock_qty ?? 0) > 0 &&
          (p.stock_qty ?? 0) <= (p.low_stock_threshold ?? 0),
      ).length ?? 0,
    out: q.data?.filter((p: any) => (p.stock_qty ?? 0) <= 0).length ?? 0,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stock"
        description="Monitor stock levels across every product and update quantities inline."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Boxes} label="Active products" value={stats.total} tone="default" />
        <StatCard icon={AlertTriangle} label="Low stock" value={stats.low} tone="warning" />
        <StatCard icon={PackageX} label="Out of stock" value={stats.out} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "low", "out"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
              filter === f
                ? "bg-[color:var(--mint)] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            ].join(" ")}
          >
            {f === "all" ? "All" : f === "low" ? "Low stock" : "Out of stock"}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU"
            className="pl-8"
          />
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Boxes}
                title="No products match"
                description="Try switching filter or clearing the search."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((p: any) => {
                const isOut = (p.stock_qty ?? 0) <= 0;
                const isLow =
                  !isOut &&
                  (p.stock_qty ?? 0) <= (p.low_stock_threshold ?? 0);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.sku ?? "—"} · {p.store?.name ?? "No store"}
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="text-xs text-muted-foreground">Threshold</div>
                      <div className="text-sm font-medium">{p.low_stock_threshold ?? 0}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">On hand</div>
                      <div className="text-sm font-semibold">{p.stock_qty ?? 0}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        isOut
                          ? "border-destructive/40 text-destructive"
                          : isLow
                            ? "border-warning/40 text-warning"
                            : "border-[color:var(--mint)]/40 text-[color:var(--mint)]"
                      }
                    >
                      {isOut ? "Out" : isLow ? "Low" : "OK"}
                    </Badge>
                    <UpdateStockPopover
                      product={p}
                      onSaved={() => qc.invalidateQueries({ queryKey: ["stock"] })}
                    />
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "default" | "warning" | "danger";
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning bg-warning/10"
      : tone === "danger"
        ? "text-destructive bg-destructive/10"
        : "text-[color:var(--mint)] bg-[color:var(--mint)]/10";
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function UpdateStockPopover({
  product,
  onSaved,
}: {
  product: any;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState<number>(product.stock_qty ?? 0);
  const [threshold, setThreshold] = useState<number>(product.low_stock_threshold ?? 0);
  const save = useMutation({
    mutationFn: () =>
      updateStock({
        data: { id: product.id, stock_qty: qty, low_stock_threshold: threshold },
      }),
    onSuccess: () => {
      toast.success("Stock updated");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">Update</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <div>
          <Label className="text-xs">On hand</Label>
          <Input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div>
          <Label className="text-xs">Low-stock threshold</Label>
          <Input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <Button
          className="w-full"
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          Save
        </Button>
      </PopoverContent>
    </Popover>
  );
}
