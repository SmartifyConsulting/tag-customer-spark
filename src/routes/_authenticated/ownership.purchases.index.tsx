import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, Download, FileSpreadsheet, Search, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { StatusBadge, warrantyState } from "@/components/ownership/shared";
import { RecordPurchaseDialog } from "@/components/ownership/record-purchase-dialog";
import { exportCsv, exportExcel, exportTablePdf } from "@/components/ownership/export";
import { listPurchases, listReceipts, summariseReceipt, updateReceipt } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/purchases/")({
  head: () => ({
    meta: [
      { title: "Purchases — Tag Ownership" },
      {
        name: "description",
        content: "Every purchase, receipt and warranty status in one consumer-owned record.",
      },
    ],
  }),
  component: PurchasesPage,
});

const ALL = "__all__";

function PurchasesPage() {
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [brand, setBrand] = useState(ALL);
  const [flag, setFlag] = useState(ALL);

  const listFn = useServerFn(listPurchases);
  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "purchases", { search, storeId, category, brand, flag }],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          storeId: storeId === ALL ? undefined : storeId,
          category: category === ALL ? undefined : category,
          brand: brand === ALL ? undefined : brand,
          warrantyExpiring: flag === "warranty" ? true : undefined,
          returned: flag === "returned" ? true : undefined,
        },
      }),
  });

  const purchases = (data as any)?.purchases ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchases"
        description="Every purchase captured digitally — the bridge between discovery and ownership."
        actions={<RecordPurchaseDialog />}
      />

      <Tabs defaultValue="purchases" className="space-y-6">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="receipts">Digital receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search product, brand, store, SKU or receipt number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FilterSelect
              value={storeId}
              onChange={setStoreId}
              placeholder="All stores"
              options={((data as any)?.stores ?? []).map((s: any) => ({ value: s.id, label: s.name }))}
            />
            <FilterSelect
              value={category}
              onChange={setCategory}
              placeholder="All categories"
              options={((data as any)?.categories ?? []).map((c: string) => ({ value: c, label: c }))}
            />
            <FilterSelect
              value={brand}
              onChange={setBrand}
              placeholder="All brands"
              options={((data as any)?.brands ?? []).map((b: string) => ({ value: b, label: b }))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: ALL, label: "Everything" },
              { key: "warranty", label: "Warranty expiring" },
              { key: "returned", label: "Returned or refunded" },
            ].map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={flag === f.key ? "default" : "outline"}
                onClick={() => setFlag(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : purchases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No purchases match those filters yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {purchases.map((p: any) => (
                <PurchaseCard key={p.id} purchase={p} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="receipts">
          <ReceiptWallet />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PurchaseCard({ purchase }: { purchase: any }) {
  const first = purchase.items?.[0];
  const extra = Math.max(0, (purchase.items?.length ?? 0) - 1);
  const w = warrantyState(purchase.warrantyExpiresOn);
  return (
    <Link
      to="/ownership/purchases/$purchaseId"
      params={{ purchaseId: purchase.id }}
      className="group block"
    >
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
          {first?.image_url ? (
            <img
              src={first.image_url}
              alt={first?.name ?? "Purchased product"}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{first?.name ?? "Purchase"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {purchase.store?.name ?? "Store"} ·{" "}
                {new Date(purchase.purchased_at).toLocaleDateString()}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold">
              {formatMoney(purchase.total_cents, purchase.currency)}
            </p>
          </div>
          {extra > 0 && (
            <p className="text-xs text-muted-foreground">+{extra} more items on this receipt</p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <StatusBadge tone={purchase.receipt ? "info" : "muted"}>
              {purchase.receipt ? `Receipt ${purchase.receipt_number ?? ""}` : "No receipt"}
            </StatusBadge>
            <StatusBadge tone={w.tone === "muted" ? "muted" : w.tone}>{w.label}</StatusBadge>
            {purchase.returnStatus && (
              <StatusBadge tone="soon">Return {purchase.returnStatus.replace("_", " ")}</StatusBadge>
            )}
            <StatusBadge>Qty {purchase.items?.reduce((s: number, i: any) => s + i.quantity, 0)}</StatusBadge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ReceiptWallet() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"active" | "favourites" | "archived">("active");
  const qc = useQueryClient();
  const listFn = useServerFn(listReceipts);
  const updateFn = useServerFn(updateReceipt);
  const summariseFn = useServerFn(summariseReceipt);

  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "receipts"],
    queryFn: () => listFn(),
  });

  const update = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ownership", "receipts"] }),
  });

  const summarise = useMutation({
    mutationFn: (id: string) => summariseFn({ data: { receiptId: id } }),
    onSuccess: () => {
      toast.success("Receipt summarised");
      qc.invalidateQueries({ queryKey: ["ownership", "receipts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not summarise the receipt"),
  });

  const rows = useMemo(() => {
    let list = ((data as any[]) ?? []).filter((r) =>
      view === "archived" ? r.is_archived : view === "favourites" ? r.is_favourite && !r.is_archived : !r.is_archived,
    );
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (r) =>
          (r.receipt_number ?? "").toLowerCase().includes(s) ||
          (r.category ?? "").toLowerCase().includes(s) ||
          (r.purchase?.store?.name ?? "").toLowerCase().includes(s) ||
          (r.purchase?.items ?? []).some((i: any) => (i.name ?? "").toLowerCase().includes(s)),
      );
    }
    return list;
  }, [data, q, view]);

  const exportRows = rows.map((r: any) => ({
    receipt_number: r.receipt_number,
    date: String(r.issued_at).slice(0, 10),
    store: r.purchase?.store?.name ?? "",
    category: r.category ?? "",
    total: (r.purchase?.total_cents ?? 0) / 100,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search receipts" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(["active", "favourites", "archived"] as const).map((v) => (
          <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>
            {v[0]!.toUpperCase() + v.slice(1)}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => exportCsv(exportRows, "tag-receipts-tax.csv")}>
          <Download className="mr-1.5 h-4 w-4" /> Tax export
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportExcel(exportRows, "tag-receipts-insurance.xlsx", "Receipts")}
        >
          <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Insurance export
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing in this part of the wallet yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.receipt_number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.purchase?.store?.name ?? "Store"} · {new Date(r.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatMoney(r.purchase?.total_cents ?? 0, r.purchase?.currency ?? "ZAR")}
                  </p>
                </div>
                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs">
                  {(r.purchase?.items ?? []).slice(0, 4).map((i: any) => (
                    <div key={i.id} className="flex justify-between">
                      <span className="truncate">
                        {i.quantity} × {i.name}
                      </span>
                      <span>{formatMoney(i.line_total_cents)}</span>
                    </div>
                  ))}
                </div>
                {r.ai_summary && <p className="text-xs text-muted-foreground">{r.ai_summary}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {r.category && <StatusBadge>{r.category}</StatusBadge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ id: r.id, isFavourite: !r.is_favourite })}
                  >
                    <Star className={r.is_favourite ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ id: r.id, isArchived: !r.is_archived })}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={summarise.isPending}
                    onClick={() => summarise.mutate(r.id)}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" /> Summarise
                  </Button>
                  <Link
                    to="/ownership/purchases/$purchaseId"
                    params={{ purchaseId: r.purchase_id }}
                    className="ml-auto text-xs font-medium underline underline-offset-4"
                  >
                    Open
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => exportTablePdf("TAG receipt wallet", exportRows, "tag-receipts.pdf")}
      >
        <Download className="mr-1.5 h-4 w-4" /> Export wallet as PDF
      </Button>
    </div>
  );
}
