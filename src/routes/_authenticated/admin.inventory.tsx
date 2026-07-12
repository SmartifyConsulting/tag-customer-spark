import { useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Search, Tag as TagIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProducts } from "@/lib/products.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  head: () => ({ meta: [{ title: "Inventory Admin — Tag" }] }),
  component: InventoryAdminPage,
});

type Tagged = "all" | "tagged" | "untagged";

function InventoryAdminPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");
  if (!canManage) return <Navigate to="/dashboard" />;

  const listFn = useServerFn(listProducts);
  const [search, setSearch] = useState("");
  const [tagged, setTagged] = useState<Tagged>("all");

  const params = useMemo(
    () => ({ search, status: "all" as const, tagged, pageSize: 100 }),
    [search, tagged],
  );

  const q = useQuery({
    queryKey: ["admin-inventory", params],
    queryFn: () => listFn({ data: params }),
  });

  const rows = (q.data?.rows ?? []) as any[];
  const taggedCount = rows.filter((r) => r.is_tagged).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Admin"
        description="Every uploaded product, tagged or not. The main Inventory screen only shows tagged items — review and tag the rest here."
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

          {q.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Package} title="No products match" description="Try a different search or filter." />
          ) : (
            <ul className="divide-y rounded-xl border">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/products/$productId"
                    params={{ productId: p.id }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50"
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
                    <Badge variant="outline" className="capitalize">{p.status}</Badge>
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
    </div>
  );
}
