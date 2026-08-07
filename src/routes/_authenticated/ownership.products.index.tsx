import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { StatusBadge, WarrantyProgress, warrantyState } from "@/components/ownership/shared";
import { exportCsv, exportExcel, exportTablePdf } from "@/components/ownership/export";
import { exportInventory, listOwnedProducts, ownershipInsights } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/products/")({
  head: () => ({
    meta: [
      { title: "My Products — Tag Ownership" },
      {
        name: "description",
        content: "Every owned product with warranty, condition and ownership status.",
      },
    ],
  }),
  component: MyProductsPage,
});

const GROUPS = ["Home", "Electronics", "Kitchen", "Garden", "Clothing", "Automotive"];

function MyProductsPage() {
  const [q, setQ] = useState("");
  const listFn = useServerFn(listOwnedProducts);
  const insightsFn = useServerFn(ownershipInsights);
  const exportFn = useServerFn(exportInventory);

  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "owned"],
    queryFn: () => listFn(),
  });

  const insights = useQuery({
    queryKey: ["ownership", "insights"],
    queryFn: () => insightsFn(),
    staleTime: 10 * 60 * 1000,
  });

  const products = ((data as any)?.products ?? []) as any[];
  const filtered = useMemo(() => {
    if (!q) return products;
    const s = q.toLowerCase();
    return products.filter((p) =>
      [p.name, p.brand, p.category, p.serial_number].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [products, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of filtered) {
      const key = GROUPS.includes(p.category) ? p.category : "Home";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => GROUPS.indexOf(a[0]) - GROUPS.indexOf(b[0]));
  }, [filtered]);

  const runExport = async (kind: "csv" | "xlsx" | "pdf") => {
    const rows = (await exportFn()) as any[];
    if (kind === "csv") exportCsv(rows, "tag-household-inventory.csv");
    if (kind === "xlsx") exportExcel(rows, "tag-household-inventory.xlsx", "Inventory");
    if (kind === "pdf") exportTablePdf("TAG household inventory", rows, "tag-household-inventory.pdf");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Products"
        description="A living inventory of everything owned — warranty, condition and value at a glance."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => runExport("pdf")}>
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => runExport("xlsx")}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => runExport("csv")}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search product, brand or serial number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {insights.data && ((insights.data as any).insights ?? []).length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4" /> Ownership insights
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {(insights.data as any).insights.map((i: any, idx: number) => (
                <div key={idx} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={i.kind === "recall" ? "expired" : i.kind === "warranty" ? "soon" : "info"}>
                      {i.kind}
                    </StatusBadge>
                    <p className="text-sm font-medium">{i.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing owned yet — record a purchase with a warranty and it will appear here.
          </CardContent>
        </Card>
      ) : (
        grouped.map(([group, list]) => (
          <section key={group} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group} · {list.length}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => (
                <OwnedCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export function OwnedCard({ product: p }: { product: any }) {
  const w = warrantyState(p.warranty?.expires_on);
  return (
    <Link to="/ownership/products/$productId" params={{ productId: p.id }} className="group block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.brand ? `${p.brand} · ` : ""}
                {p.purchased_at ? new Date(p.purchased_at).toLocaleDateString() : "—"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold">
              {formatMoney(p.current_value_cents ?? p.purchase_price_cents ?? 0)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={w.tone}>{w.label}</StatusBadge>
            <StatusBadge>{p.condition ?? "good"}</StatusBadge>
            <StatusBadge tone={p.ownership_status === "owned" ? "ok" : "muted"}>
              {p.ownership_status ?? "owned"}
            </StatusBadge>
            {p.room?.name && <StatusBadge tone="info">{p.room.name}</StatusBadge>}
          </div>
          <WarrantyProgress startsOn={p.warranty?.starts_on} expiresOn={p.warranty?.expires_on} />
        </CardContent>
      </Card>
    </Link>
  );
}
