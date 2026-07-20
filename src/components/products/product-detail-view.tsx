import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, ArrowLeft, Edit, Loader2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  archiveProduct,
  bulkCompleteDigitalIdentity,
  deleteProduct,
  getProduct,
} from "@/lib/products.functions";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { PassportTab } from "@/components/products/passport-tab";
import { ProductQrPanel } from "@/components/qr/product-qr-panel";
import { ProductIntentPanel } from "@/components/intent/product-intent-panel";
import { ProductImage } from "@/components/products/product-image";
import { DigitalIdentityProgress } from "@/components/qr/digital-identity-progress";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

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
  const bulkCompleteFn = useServerFn(bulkCompleteDigitalIdentity);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fn({ data: { id: productId } }),
  });

  // Silently finish this product's digital identity if it's stalled.
  const autoCompleteRan = useRef(false);
  useEffect(() => {
    if (autoCompleteRan.current || !data?.product) return;
    const p = data.product as any;
    const gtin = String(p.gtin ?? "").trim();
    if (!gtin) return;
    const enrichment = (data as any).passport?.enrichment_status ?? "pending";
    const incomplete =
      !p.normalised_at ||
      !p.image_status ||
      p.image_status === "pending" ||
      p.qr_status !== "active" ||
      !["enriched", "complete", "manual"].includes(enrichment);
    if (!incomplete) return;
    autoCompleteRan.current = true;
    bulkCompleteFn({ data: { productIds: [productId] } })
      .then((res) => {
        qc.invalidateQueries({ queryKey: ["product", productId] });
        if (res.errors.length === 0) return;
        const qrErr = res.errors.find((e: any) => e.step === "qr");
        if (qrErr) {
          try {
            const parsed = JSON.parse(qrErr.message);
            if (parsed?.code === "GTIN_CLASH") {
              toast.error(
                `Duplicate GTIN with "${parsed.otherProductName ?? "another product"}". Open the QR panel below to merge.`,
              );
              return;
            }
          } catch {
            /* not structured — fall through */
          }
        }
        const first = res.errors[0];
        toast.error(`Digital identity build didn't finish — ${first.step}: ${first.message}`);
      })
      .catch((e: any) => {
        toast.error(`Digital identity build failed to run — ${e?.message ?? "unknown error"}`);
      });
  }, [data, productId, bulkCompleteFn, qc]);

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-6">
        {/* Back link */}
        <div>
          <Link
            to={backTo}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
          </Link>
        </div>

        {/* Header card: image + info + inline Digital Identity Build + icon actions */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid gap-5 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
            {/* Image */}
            <div className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
              <ProductImage product={p as any} variant="hero" alt={p.name} />
            </div>

            {/* Middle: title / price / facts */}
            <div className="grid content-start gap-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                  {p.name}
                  {p.on_promotion && (
                    <Star
                      className="h-4 w-4 fill-red-600 text-red-600"
                      aria-label={p.promotion_label ?? "On promotion"}
                    />
                  )}
                </h1>
                <Badge variant="outline" className="capitalize">
                  {p.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                SKU {p.sku}
                {p.brand ? ` · ${p.brand}` : ""}
              </p>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className={`text-xl font-semibold ${onSale ? "text-success" : ""}`}>
                  {formatMoney(onSale ? p.sale_price_cents : p.price_cents, p.currency)}
                </span>
                {onSale && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatMoney(p.price_cents, p.currency)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Fact label="Category" value={p.category?.name ?? "—"} />
                <Fact label="Store" value={p.store?.name ?? "—"} />
                <Fact label="Stock" value={`${p.stock_qty}`} />
                <Fact label="Low at" value={`${p.low_stock_threshold}`} />
              </div>
            </div>

            {/* Right: inline Digital Identity Build + icon actions */}
            <div className="relative min-w-0">
              {canManage && (
                <div className="absolute right-0 top-0 flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditOpen(true)}
                        aria-label="Edit product"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  {p.status !== "archived" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => archive.mutate()}
                          aria-label="Archive product"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(true)}
                        aria-label="Delete product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              )}
              <div className={canManage ? "pr-28" : ""}>
                <DigitalIdentityProgress
                  product={p as any}
                  qr={data.qr ? { active: (data.qr as any).status === "active" } : null}
                  passport={(data as any).passport ?? null}
                  embedded
                />
              </div>
            </div>
          </div>
        </div>

        {/* Merged QR + Passport card */}
        <div id="product-qr" className="grid gap-6 rounded-xl border border-border bg-card p-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              QR Status
            </p>
            <ProductQrPanel
              productId={productId}
              productName={p.name}
              qr={data.qr as any}
              dppId={(p as any).digital_product_passport_id}
              embedded
            />
          </div>
          <div>
            <PassportTab
              productId={productId}
              dppId={(p as any).digital_product_passport_id}
            />
          </div>
        </div>

        <ProductIntentPanel productId={productId} />

        {canManage && editOpen && (
          <ProductFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            productId={productId}
            initial={{
              ...p,
              images: (p.images as any[]) ?? [],
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
    </TooltipProvider>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium truncate">{value}</p>
    </div>
  );
}
