import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { Barcode, FileDown, Layers, List, Loader2, Package, Plus, Sparkles, Upload, Wand2 } from "lucide-react";
import { DynamicTaxonomyBrowser } from "@/components/products/dynamic-taxonomy-browser";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductsToolbar } from "@/components/products/products-toolbar";
import {
  ProductsTable,
  type ProductRow,
} from "@/components/products/products-table";
import { ProductsPagination } from "@/components/products/products-pagination";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { BulkQrDialog } from "@/components/qr/bulk-qr-dialog";
import { ImportProductsDialog } from "@/components/products/import-products-dialog";

import {
  archiveProduct,
  bulkCompleteDigitalIdentity,
  deleteProduct,
  getProductFormOptions,
  listIncompleteDigitalIdentityIds,
  listProducts,
} from "@/lib/products.functions";
import { assignMissingBarcodes } from "@/lib/barcode-assign.functions";
import { useAuth } from "@/hooks/use-auth";


const searchSchema = z.object({
  search: fallback(z.string(), "").default(""),
  showArchived: fallback(z.boolean(), false).default(false),
  category: fallback(z.string().nullable(), null).default(null),
  store: fallback(z.string().nullable(), null).default(null),
  promo: fallback(z.boolean(), false).default(false),
  lowStock: fallback(z.boolean(), false).default(false),
  sort: fallback(z.enum(["recent", "name", "price", "stock"]), "recent").default("recent"),
  page: fallback(z.number().int().min(1), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/products/")({
  head: () => ({ meta: [{ title: "Inventory — Tag" }] }),
  validateSearch: zodValidator(searchSchema),
  component: ProductsListPage,
});

function ProductsListPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products" });
  const { hasRole } = useAuth();
  const canManage =
    hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");
  const isSuperAdmin = hasRole("super_admin");

  const optsFn = useServerFn(getProductFormOptions);
  const listFn = useServerFn(listProducts);
  const archiveFn = useServerFn(archiveProduct);
  const deleteFn = useServerFn(deleteProduct);
  const bulkCompleteFn = useServerFn(bulkCompleteDigitalIdentity);
  const listIncompleteFn = useServerFn(listIncompleteDigitalIdentityIds);
  const assignBarcodesFn = useServerFn(assignMissingBarcodes);
  const qc = useQueryClient();


  const { data: opts } = useQuery({
    queryKey: ["product-form-options"],
    queryFn: () => optsFn(),
    staleTime: 60_000,
  });

  const [viewMode, setViewMode] = useState<"list" | "browse">("list");
  const [searchTerm, setSearchTerm] = useState(search.search);
  useEffect(() => setSearchTerm(search.search), [search.search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== search.search) {
        navigate({ search: (p: any) => ({ ...p, search: searchTerm, page: 1 }) });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, search.search, navigate]);

  const params = useMemo(
    () => ({
      search: search.search,
      status: (search.showArchived ? "archived" : "active") as
        | "archived"
        | "active",
      category_id: search.category,
      store_id: search.store,
      promotion: search.promo,
      low_stock: search.lowStock,
      // Inventory only ever shows tagged items — untagged/uploaded-but-not-yet-
      // tagged products are reviewed from Admin > Inventory instead.
      tagged: "tagged" as const,
      sort: search.sort,
      page: search.page,
      pageSize: 100,
    }),
    [search],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["products", params],
    queryFn: () => listFn({ data: params }),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Archived");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const rows = (data?.rows ?? []) as ProductRow[];
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const r of rows) {
      const key = r.category?.name ?? "Uncategorised";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0] === "Uncategorised" ? 1 : b[0] === "Uncategorised" ? -1 : a[0].localeCompare(b[0]),
    );
  }, [rows]);

  const hasFilters =
    !!search.search ||
    search.showArchived ||
    !!search.category ||
    !!search.store ||
    search.promo ||
    search.lowStock;

  const [completing, setCompleting] = useState(false);
  const handleCompleteIdentity = async () => {
    if (completing) return;
    setCompleting(true);
    const toastId = toast.loading("Finding products that need attention…");
    try {
      const { ids } = await listIncompleteFn();
      if (ids.length === 0) {
        toast.success("All products already have a complete digital identity.", { id: toastId });
        return;
      }
      const CHUNK = 10;
      let done = 0;
      let succeeded = 0;
      let skipped = 0;
      const allErrors: Array<{ productId: string; step: string; message: string }> = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        toast.loading(`Completing digital identity… ${done} / ${ids.length}`, { id: toastId });
        const r = await bulkCompleteFn({ data: { productIds: chunk } });
        succeeded += r.succeeded;
        skipped += r.skipped;
        allErrors.push(...r.errors);
        done += chunk.length;
      }
      await qc.invalidateQueries();
      const errText = allErrors.length ? ` (${allErrors.length} issues)` : "";
      toast.success(
        `Done — ${succeeded} completed${skipped ? `, ${skipped} skipped` : ""}${errText}.`,
        { id: toastId },
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk completion failed", { id: toastId });
    } finally {
      setCompleting(false);
    }
  };

  const [assigningBarcodes, setAssigningBarcodes] = useState(false);
  const handleAssignBarcodes = async () => {
    if (assigningBarcodes) return;
    if (!confirm("Assign valid GTIN-13 barcodes to any product missing one, then queue QR generation?")) return;
    setAssigningBarcodes(true);
    const id = toast.loading("Generating barcodes…");
    try {
      const r = await assignBarcodesFn();
      await qc.invalidateQueries();
      toast.success(
        r.updated === 0
          ? "All products already have barcodes."
          : `Assigned barcodes to ${r.updated} product${r.updated === 1 ? "" : "s"}. Click "Complete digital identity" to generate QRs.`,
        { id },
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Barcode assignment failed", { id });
    } finally {
      setAssigningBarcodes(false);
    }
  };


  return (
    <div className="grid gap-6">
      <PageHeader
        title="Inventory"
        description="Manage products, stock levels, and QR tags in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border">
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                className="rounded-none"
                onClick={() => setViewMode("list")}
              >
                <List className="mr-1 h-3.5 w-3.5" /> List
              </Button>
              <Button
                size="sm"
                variant={viewMode === "browse" ? "default" : "ghost"}
                className="rounded-none"
                onClick={() => setViewMode("browse")}
              >
                <Layers className="mr-1 h-3.5 w-3.5" /> Browse
              </Button>
            </div>
            {canManage && selectedIds.length > 0 && (
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                <FileDown className="mr-2 h-4 w-4" />
                Bulk QR PDF ({selectedIds.length})
              </Button>
            )}
            {canManage && (
              <Button variant="outline" onClick={handleCompleteIdentity} disabled={completing}>
                {completing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Complete digital identity
              </Button>
            )}
            {canManage && (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
            )}
            {canManage && (
              <Button variant="outline" onClick={handleAssignBarcodes} disabled={assigningBarcodes}>
                {assigningBarcodes ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Barcode className="mr-2 h-4 w-4" />
                )}
                Generate barcodes
              </Button>
            )}
            {canManage && (
              <Button variant="outline" asChild>
                <Link to="/setup">
                  <Wand2 className="mr-2 h-4 w-4" /> TAG Setup
                </Link>
              </Button>
            )}

            {canManage && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            )}
          </div>
        }
      />




      {viewMode === "browse" ? (
        <DynamicTaxonomyBrowser />
      ) : (<>
      <ProductsToolbar
        value={{
          search: searchTerm,
          showArchived: search.showArchived,
          category_id: search.category,
          store_id: search.store,
          promotion: search.promo,
          low_stock: search.lowStock,
          sort: search.sort,
        }}
        onChange={(next) => {
          if ("search" in next) {
            setSearchTerm(next.search ?? "");
            return;
          }
          navigate({
            search: (p: any) => ({
              ...p,
              showArchived:
                "showArchived" in next ? !!next.showArchived : p.showArchived,
              category: "category_id" in next ? next.category_id ?? null : p.category,
              store: "store_id" in next ? next.store_id ?? null : p.store,
              promo: "promotion" in next ? !!next.promotion : p.promo,
              lowStock: "low_stock" in next ? !!next.low_stock : p.lowStock,
              sort: next.sort ?? p.sort,
              page: 1,
            }),
          });
        }}
        categories={opts?.categories ?? []}
        stores={opts?.stores ?? []}
      />

      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          size="lg"
          icon={Package}
          title={hasFilters ? "No products match your filters" : "Your catalogue is empty"}
          description={
            hasFilters
              ? "Try clearing filters or refining your search — your full catalogue is one click away."
              : "Add your first product to start generating QR tags, tracking intent and recovering lost sales."
          }
          action={
            canManage ? (
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-[color:var(--mint)] text-[color:var(--mint-foreground)] hover:bg-[color:var(--mint)]/90"
              >
                <Plus className="mr-2 h-4 w-4" /> Add your first product
              </Button>
            ) : undefined
          }
          secondaryAction={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  navigate({
                    search: () => ({
                      search: "",
                      showArchived: false,
                      category: null,
                      store: null,
                      promo: false,
                      lowStock: false,
                      sort: "recent" as const,
                      page: 1,
                    }),
                  })
                }
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Accordion type="multiple" className="grid gap-2">
          {grouped.map(([category, items]) => {
            const lowCount = items.filter(
              (p) => (p.stock_qty ?? 0) <= (p.low_stock_threshold ?? 0),
            ).length;
            return (
              <AccordionItem
                key={category}
                value={category}
                className="rounded-2xl border border-border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center gap-3 pr-3">
                    <span className="text-base font-semibold text-foreground">
                      {category}
                    </span>
                    <Badge variant="default">{items.length}</Badge>
                    {lowCount > 0 && (
                      <Badge variant="warning">{lowCount} low stock</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <ProductsTable
                    rows={items}
                    selected={selected}
                    onSelectChange={setSelected}
                    onEdit={(r) => setEditing(r)}
                    onArchive={(r) => archive.mutate(r.id)}
                    onDelete={(r) => remove.mutate(r.id)}
                    canManage={canManage}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <ProductsPagination
        page={search.page}
        pageSize={100}
        total={data?.total ?? 0}
        onPage={(p) => navigate({ search: (s: any) => ({ ...s, page: p }) })}
      />
      </>)}

      {canManage && (
        <ProductFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
      {canManage && editing && (
        <ProductFormDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          productId={editing.id}
          initial={{
            ...(editing as any),
            images: (editing.images as any) ?? [],
            category_id: (editing as any).category?.id ?? null,
            store_id: (editing as any).store?.id ?? null,
          }}
        />
      )}
      <BulkQrDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        productIds={selectedIds}
      />
      <ImportProductsDialog open={importOpen} onOpenChange={setImportOpen} />

      {archive.isPending || remove.isPending ? (
        <div className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs shadow-md">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
        </div>
      ) : null}
    </div>
  );
}
