import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Archive,
  ArrowLeft,
  Edit,
  RefreshCw,
  Smartphone,
  Star,
  Tag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { archiveProduct, deleteProduct, getProduct } from "@/lib/products.functions";
import { resetProductImage } from "@/lib/product-images.functions";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { PassportTab } from "@/components/products/passport-tab";
import { ProductQrPanel } from "@/components/qr/product-qr-panel";
import { ProductIntentPanel } from "@/components/intent/product-intent-panel";
import { ScansTable } from "@/components/qr/scans-table";
import { ProductImage } from "@/components/products/product-image";
import { DigitalIdentityProgress } from "@/components/qr/digital-identity-progress";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function ProductDetailView({
  productId,
  backTo = "/products",
  backLabel = "Products",
}: {
  productId: string;
  backTo?: string;
  backLabel?: string;
}) {
  const { hasRole } = useAuth();
  const canManage = hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");

  const fn = useServerFn(getProduct);
  const archiveFn = useServerFn(archiveProduct);
  const deleteFn = useServerFn(deleteProduct);
  const resetImageFn = useServerFn(resetProductImage);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fn({ data: { id: productId } }),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archive = useMutation({
    mutationFn: () => archiveFn({ data: { id: productId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      toast.success("Archived");
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: productId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      toast.success("Deleted");
      window.history.back();
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });
  const refreshImage = useMutation({
    mutationFn: () => resetImageFn({ data: { productId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("Image refreshed with a fresh lookup.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to refresh image"),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-60 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (!data?.product) return <p className="text-sm">Not found.</p>;

  const p = data.product as any;
  const onSale = p.sale_price_cents != null && p.sale_price_cents < p.price_cents;
  const images = (p.images as any[]) ?? [];
  const primary = images[0]?.url ?? p.image_url;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={backTo}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
        </Link>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="grid gap-2">
          <div className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            <ProductImage product={p as any} variant="hero" alt={p.name} />
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.slice(0, 4).map((img: any) => (
                <div
                  key={img.url}
                  className="aspect-square overflow-hidden rounded-md border border-border"
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid content-start gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                {p.name}
                {p.on_promotion && (
                  <Star
                    className="h-4 w-4 fill-red-600 text-red-600"
                    aria-label={p.promotion_label ?? "On promotion"}
                  />
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                SKU {p.sku}
                {p.brand ? ` · ${p.brand}` : ""}
              </p>
            </div>
            <Badge variant="outline" className="capitalize">
              {p.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className={`text-xl font-semibold ${onSale ? "text-success" : ""}`}>
              {formatMoney(onSale ? p.sale_price_cents : p.price_cents, p.currency)}
            </span>
            {onSale && (
              <span className="text-sm text-muted-foreground line-through">
                {formatMoney(p.price_cents, p.currency)}
              </span>
            )}
            {p.description && (
              <span className="text-sm text-muted-foreground">{p.description}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Category" value={p.category?.name ?? "—"} />
            <Fact label="Store" value={p.store?.name ?? "—"} />
            <Fact label="Stock" value={`${p.stock_qty}`} />
            <Fact label="Low at" value={`${p.low_stock_threshold}`} />
            {p.color && <Fact label="Colour" value={p.color} />}
            {p.size && <Fact label="Size" value={p.size} />}
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshImage.mutate()}
                disabled={refreshImage.isPending}
              >
                <RefreshCw
                  className={`mr-2 h-3.5 w-3.5 ${refreshImage.isPending ? "animate-spin" : ""}`}
                />
                Refresh image
              </Button>
              {p.status !== "archived" && (
                <Button size="sm" variant="outline" onClick={() => archive.mutate()}>
                  <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      <div id="product-qr" className="grid gap-4 md:grid-cols-2">
        <ProductQrPanel
          productId={productId}
          productName={p.name}
          qr={data.qr as any}
          dppId={(p as any).digital_product_passport_id}
        />
        <DigitalIdentityProgress
          product={p as any}
          qr={data.qr ? { active: (data.qr as any).status === "active" } : null}
          passport={(data as any).passport ?? null}
        />
      </div>

      <PassportTab productId={productId} dppId={(p as any).digital_product_passport_id} />

      <ProductIntentPanel productId={productId} />

      <Tabs defaultValue="scans">
        <TabsList>
          <TabsTrigger value="scans">
            <Smartphone className="mr-2 h-4 w-4" /> Scans
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="mr-2 h-4 w-4" /> Analytics
          </TabsTrigger>
        </TabsList>
        <TabsContent value="scans" className="pt-4">
          <ScansTable productId={productId} />
        </TabsContent>
        <TabsContent value="analytics" className="pt-4">
          <AnalyticsTab analytics={data.analytics} />
        </TabsContent>
      </Tabs>

      {canManage && editOpen && (
        <ProductFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          productId={productId}
          initial={{
            ...p,
            images: images,
            category_id: p.category?.id ?? null,
            store_id: p.store?.id ?? null,
          }}
        />
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product, its QR tags and scan history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function AnalyticsTab({ analytics }: { analytics: any }) {
  const kpis = [
    { label: "Scans (30d)", value: analytics.scans30 },
    { label: "Scans (all time)", value: analytics.scansTotal },
    { label: "Customers waiting", value: analytics.interestedCount },
    { label: "Notifications sent", value: analytics.notifSent },
    {
      label: "Revenue recovered",
      value: formatMoney(analytics.recoveredCents, analytics.currency),
    },
  ];
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">Scans · last 30 days</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.trend}>
              <defs>
                <linearGradient id="scanFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                fill="url(#scanFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {Object.keys(analytics.deviceCounts).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Device breakdown</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(analytics.deviceCounts).map(([d, n]) => (
              <Badge key={d} variant="outline" className="capitalize">
                {d}: {n as number}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
