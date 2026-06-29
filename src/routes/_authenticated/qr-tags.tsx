import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QrCode, Search, ScanLine, Eye, Power } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { listQrTagsRegistry, toggleTagStatus } from "@/lib/qr-tags.functions";

export const Route = createFileRoute("/_authenticated/qr-tags")({
  head: () => ({ meta: [{ title: "QR Tags — Tag" }] }),
  component: QrTagsPage,
});

function QrTagsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const list = useQuery({ queryKey: ["qrtags", search, status], queryFn: () => listQrTagsRegistry({ data: { search, status } }) });

  const toggle = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleTagStatus({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qrtags"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="QR Tags" description="Every printable QR tag on your shop floors — generate, assign, print and monitor performance." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Active tags" value={list.data?.totals.active ?? 0} icon={QrCode} />
        <Tile label="Inactive" value={list.data?.totals.inactive ?? 0} icon={Power} />
        <Tile label="Total scans" value={list.data?.totals.scans ?? 0} icon={ScanLine} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Tag registry</CardTitle>
            <CardDescription>Manage individual QR tags. Open a product to regenerate, print or download PDFs.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search code or product" className="h-9 w-56 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-6 py-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>Product</span><span>Store</span><span>Scans</span><span>Last scan</span><span></span>
            </div>
            {list.isLoading ? (
              <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (list.data?.rows ?? []).length === 0 ? (
              <div className="p-6"><EmptyState icon={QrCode} title="No QR tags yet" description="Generate tags from the Products page." /></div>
            ) : (list.data!.rows as any[]).map((t) => (
              <div key={t.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-3 px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {t.product?.image_url ? <img src={t.product.image_url} className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.product?.name ?? "Product"}</p>
                    <p className="font-mono text-xs text-muted-foreground">/s/{t.short_code}</p>
                  </div>
                </div>
                <span className="truncate text-sm text-muted-foreground">{t.store?.name ?? "—"}</span>
                <span className="text-sm tabular-nums">{t.scans_total} <span className="text-xs text-muted-foreground">({t.unique_scanners} unique)</span></span>
                <span className="text-xs text-muted-foreground">{t.last_scan_at ? new Date(t.last_scan_at).toLocaleString() : "—"}</span>
                <div className="flex items-center justify-end gap-2">
                  <Switch checked={t.is_active} onCheckedChange={(v) => toggle.mutate({ id: t.id, is_active: v })} />
                  {t.product?.id && (
                    <Link to="/products/$productId" params={{ productId: t.product.id }}>
                      <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, icon: Icon }: any) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const Badge_ = Badge;
