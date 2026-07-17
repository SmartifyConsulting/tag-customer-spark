import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  Barcode,
  Loader2,
  Package,
  Plus,
  QrCode,
  Search,
  Tag as TagIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ImportProductsDialog } from "@/components/products/import-products-dialog";
import {
  bulkCompleteDigitalIdentity,
  bulkDeleteProducts,
  listIncompleteDigitalIdentityIds,
  listProducts,
} from "@/lib/products.functions";
import { backfillStaleProductImages } from "@/lib/product-images.functions";
import { assignMissingBarcodes } from "@/lib/barcode-assign.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  head: () => ({ meta: [{ title: "Inventory Admin — Tag" }] }),
  component: InventoryAdminPage,
});

type Tagged = "all" | "tagged" | "untagged";

function InventoryAdminPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");

  const listFn = useServerFn(listProducts);
  const bulkCompleteFn = useServerFn(bulkCompleteDigitalIdentity);
  const listIncompleteFn = useServerFn(listIncompleteDigitalIdentityIds);
  const assignBarcodesFn = useServerFn(assignMissingBarcodes);
  const bulkDeleteFn = useServerFn(bulkDeleteProducts);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tagged, setTagged] = useState<Tagged>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const params = useMemo(
    () => ({ search, status: "all" as const, tagged, pageSize: 100 }),
    [search, tagged],
  );

  const q = useQuery({
    queryKey: ["admin-inventory", params],
    queryFn: () => listFn({ data: params }),
  });

  // Silently retry image resolution for a few products still stuck on a
  // fallback image each time this page loads — no button, no loading state;
  // any newly-found photos just appear once the list re-fetches.
  const backfillFn = useServerFn(backfillStaleProductImages);
  const backfillRan = useRef(false);
  useEffect(() => {
    if (backfillRan.current) return;
    backfillRan.current = true;
    (async () => {
      for (let i = 0; i < 5; i++) {
        const res = await backfillFn().catch(() => null);
        if (!res || res.processed === 0) break;
        if (res.changed > 0) qc.invalidateQueries({ queryKey: ["admin-inventory"] });
        if (!res.remaining) break;
      }
    })();
  }, [backfillFn, qc]);

  const rows = (q.data?.rows ?? []) as any[];
  const taggedCount = rows.filter((r) => r.is_tagged).length;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteFn({ data: { ids } }),
    onSuccess: (res) => {
      qc.invalidateQueries();
      setSelected(new Set());
      toast.success(`Deleted ${res.deleted} product${res.deleted === 1 ? "" : "s"}.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const handleDeleteSelected = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length} selected product${ids.length === 1 ? "" : "s"}? This permanently removes them, their QR tags and scan history.`,
      )
    )
      return;
    bulkDelete.mutate(ids);
  };

  const handleDeleteAll = () => {
    if (rows.length === 0) return;
    if (
      !confirm(
        `Delete all ${rows.length} product${rows.length === 1 ? "" : "s"} shown here? This permanently removes them, their QR tags and scan history.`,
      )
    )
      return;
    bulkDelete.mutate(rows.map((r) => r.id));
  };

  // Merges what used to be two separate actions ("Generate barcodes" then
  // "Complete digital identity") into one pipeline: a product needs a
  // barcode before a QR/digital identity can be generated for it, so this
  // always assigns missing barcodes first, then completes digital identity
  // for whatever still needs it.
  const [runningTagIntelligence, setRunningTagIntelligence] = useState(false);
  const handleTagIntelligence = async () => {
    if (runningTagIntelligence) return;
    if (
      !confirm(
        "Assign valid GTIN-13 barcodes to any product missing one, then generate QR codes for everything that needs one?",
      )
    )
      return;
    setRunningTagIntelligence(true);
    const toastId = toast.loading("Assigning barcodes…");
    try {
      const barcodeResult = await assignBarcodesFn();
      await qc.invalidateQueries();

      toast.loading("Finding products that need attention…", { id: toastId });
      const { ids } = await listIncompleteFn();
      const barcodeText =
        barcodeResult.updated > 0
          ? `${barcodeResult.updated} barcode${barcodeResult.updated === 1 ? "" : "s"} assigned`
          : "";

      if (ids.length === 0) {
        toast.success(
          [barcodeText, "all products already have a complete digital identity"]
            .filter(Boolean)
            .join(" — "),
          { id: toastId },
        );
        return;
      }

      const CHUNK = 10;
      let done = 0;
      let succeeded = 0;
      let skipped = 0;
      const allErrors: Array<{ productId: string; step: string; message: string }> = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        toast.loading(`Generating QR codes… ${done} / ${ids.length}`, { id: toastId });
        const r = await bulkCompleteFn({ data: { productIds: chunk } });
        succeeded += r.succeeded;
        skipped += r.skipped;
        allErrors.push(...r.errors);
        done += chunk.length;
      }
      await qc.invalidateQueries();
      const errText = allErrors.length ? ` (${allErrors.length} issues)` : "";
      toast.success(
        [
          barcodeText,
          `${succeeded} QR code${succeeded === 1 ? "" : "s"} generated${skipped ? `, ${skipped} skipped` : ""}${errText}`,
        ]
          .filter(Boolean)
          .join(" — "),
        { id: toastId },
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Tag intelligence run failed", { id: toastId });
    } finally {
      setRunningTagIntelligence(false);
    }
  };

  if (!canManage) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Admin"
        description="Every uploaded product, tagged or not. The main Inventory screen only shows tagged items — review and tag the rest here."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTagIntelligence}
              disabled={runningTagIntelligence}
            >
              {runningTagIntelligence ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <span className="mr-2 inline-flex items-center gap-1">
                  <Barcode className="h-4 w-4" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <QrCode className="h-4 w-4" />
                </span>
              )}
              Tag Intelligence
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tagged} onValueChange={(v) => setTagged(v as Tagged)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="tagged">Tagged only</SelectItem>
                <SelectItem value="untagged">Untagged only</SelectItem>
              </SelectContent>
            </Select>
            {!q.isLoading && (
              <span className="text-sm text-muted-foreground">
                {rows.length} shown · {taggedCount} tagged · {rows.length - taggedCount} untagged
              </span>
            )}
          </div>

          {!q.isLoading && rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) =>
                    setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())
                  }
                />
                {selected.size > 0 ? `${selected.size} selected` : "Select all"}
              </label>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={selected.size === 0 || bulkDelete.isPending}
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={bulkDelete.isPending}
                  onClick={handleDeleteAll}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete all ({rows.length})
                </Button>
              </div>
            </div>
          )}

          {q.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products match"
              description="Try a different search or filter."
            />
          ) : (
            <ul className="divide-y rounded-xl border">
              {rows.map((p) => (
                <li key={p.id} className="flex items-center gap-1 pl-3">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleSelected(p.id)}
                    aria-label={`Select ${p.name}`}
                  />
                  <Link
                    to="/products/$productId"
                    params={{ productId: p.id }}
                    className="flex flex-1 items-center gap-3 px-2 py-2 hover:bg-muted/50"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[p.sku, p.brand, p.category?.name].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {p.status}
                    </Badge>
                    {p.is_tagged ? (
                      <Badge className="gap-1 bg-primary text-primary-foreground">
                        <TagIcon className="h-3 w-3" /> Tagged
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Untagged</Badge>
                    )}
                    <Badge variant="outline">{p.stock_qty ?? 0} qty</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportProductsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
