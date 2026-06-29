import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { FileDown, Loader2, Package, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ProductsToolbar } from "@/components/products/products-toolbar";
import {
  ProductsTable,
  type ProductRow,
} from "@/components/products/products-table";
import { ProductsPagination } from "@/components/products/products-pagination";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { BulkQrDialog } from "@/components/qr/bulk-qr-dialog";
import {
  archiveProduct,
  deleteProduct,
  getProductFormOptions,
  listProducts,
} from "@/lib/products.functions";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({
  search: fallback(z.string(), "").default(""),
  status: fallback(z.enum(["all", "active", "draft", "archived"]), "all").default("all"),
  category: fallback(z.string().nullable(), null).default(null),
  store: fallback(z.string().nullable(), null).default(null),
  promo: fallback(z.boolean(), false).default(false),
  lowStock: fallback(z.boolean(), false).default(false),
  sort: fallback(z.enum(["recent", "name", "price", "stock"]), "recent").default("recent"),
  page: fallback(z.number().int().min(1), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/products/")({
  head: () => ({ meta: [{ title: "Products — Tag" }] }),
  validateSearch: zodValidator(searchSchema),
  component: ProductsListPage,
});

function ProductsListPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products" });
  const { hasRole } = useAuth();
  const canManage =
    hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");

  const optsFn = useServerFn(getProductFormOptions);
  const listFn = useServerFn(listProducts);
  const archiveFn = useServerFn(archiveProduct);
  const deleteFn = useServerFn(deleteProduct);
  const qc = useQueryClient();

  const { data: opts } = useQuery({
    queryKey: ["product-form-options"],
    queryFn: () => optsFn(),
    staleTime: 60_000,
  });

  // local debounce of search term
  const [searchTerm, setSearchTerm] = useState(search.search);
  useEffect(() => setSearchTerm(search.search), [search.search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== search.search) {
        if (searchTerm !== search.search) navigate({ search: (p: any) => ({ ...p, search: searchTerm, page: 1 }) });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, search.search, navigate]);

  const params = useMemo(
    () => ({
      search: search.search,
      status: search.status,
      category_id: search.category,
      store_id: search.store,
      promotion: search.promo,
      low_stock: search.lowStock,
      sort: search.sort,
      page: search.page,
      pageSize: 20,
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

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Products"
        description="Add, organize, and tag the products your customers can opt in to."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage && selectedIds.length > 0 && (
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                <FileDown className="mr-2 h-4 w-4" />
                Bulk QR PDF ({selectedIds.length})
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add product
              </Button>
            )}
          </div>
        }
      />

      <ProductsToolbar
        value={{
          search: searchTerm,
          status: search.status,
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
              status: next.status ?? p.status,
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
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products match"
          description={
            search.search || search.status !== "all"
              ? "Try clearing filters or search."
              : "Add your first product to start tagging."
          }
          action={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ProductsTable
          rows={rows}
          selected={selected}
          onSelectChange={setSelected}
          onEdit={(r) => setEditing(r)}
          onArchive={(r) => archive.mutate(r.id)}
          onDelete={(r) => remove.mutate(r.id)}
          canManage={canManage}
        />
      )}

      <ProductsPagination
        page={search.page}
        pageSize={20}
        total={data?.total ?? 0}
        onPage={(p) => navigate({ search: (s: any) => ({ ...s, page: p }) })}
      />

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

      {archive.isPending || remove.isPending ? (
        <div className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs shadow-md">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
        </div>
      ) : null}
    </div>
  );
}
