import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, Download, FileSpreadsheet, Search, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { LifecycleAlerts } from "@/components/ownership/lifecycle-alerts";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QrPreview } from "@/components/qr/qr-preview";
import { formatMoney } from "@/lib/format";
import { StatusBadge, warrantyState } from "@/components/ownership/shared";
import { RecordPurchaseDialog } from "@/components/ownership/record-purchase-dialog";
import { exportCsv, exportExcel, exportTablePdf } from "@/components/ownership/export";
import {
  listPurchases,
  listReceipts,
  listReturns,
  summariseReceipt,
  updateReceipt,
  updateReturnStatus,
} from "@/lib/ownership.functions";

const RETURN_STATUSES = ["requested", "in_progress", "approved", "rejected", "refunded"] as const;

function groupByDate(purchases: any[]) {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const monthAgo = now - 30 * 24 * 3600 * 1000;

  const groups: { label: string; items: any[] }[] = [
    { label: "Today", items: [] },
    { label: "This week", items: [] },
    { label: "This month", items: [] },
    { label: "Older", items: [] },
  ];
  for (const p of purchases) {
    const t = new Date(p.purchased_at).getTime();
    if (t >= startOfDay.getTime()) groups[0].items.push(p);
    else if (t >= weekAgo) groups[1].items.push(p);
    else if (t >= monthAgo) groups[2].items.push(p);
    else groups[3].items.push(p);
  }
  return groups.filter((g) => g.items.length > 0);
}

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
        title="Receipts"
        description="Your digital receipts and purchase history in one place."
        actions={<RecordPurchaseDialog />}
      />

      <LifecycleAlerts />

      <Tabs defaultValue="receipts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts">
          <ReceiptWallet />
        </TabsContent>

        <TabsContent value="returns">
          <ReturnsTab />
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

function ReturnsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReturns);
  const updateFn = useServerFn(updateReturnStatus);
  const [openQr, setOpenQr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["ownership", "returns"], queryFn: () => listFn() });

  const update = useMutation({
    mutationFn: (v: { id: string; status: (typeof RETURN_STATUSES)[number] }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Return updated");
      qc.invalidateQueries({ queryKey: ["ownership"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the return"),
  });

  const rows = (data as any[]) ?? [];

  if (isLoading) return <Skeleton className="h-56 rounded-xl" />;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No returns in progress. Open a purchase and choose "Start return".
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((r) => {
        const eligible = r.window_ends_on ? new Date(r.window_ends_on).getTime() >= Date.now() : false;
        return (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.item?.name ?? "Item"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.purchase?.store?.name ?? "Store"} · Receipt {r.purchase?.receipt_number ?? "—"}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatMoney(r.refund_cents ?? 0)}</p>
              </div>
              <p className="text-sm text-muted-foreground">{r.reason}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={r.status === "refunded" ? "ok" : r.status === "rejected" ? "expired" : "soon"}>
                  {String(r.status).replace("_", " ")}
                </StatusBadge>
                <StatusBadge tone={eligible ? "ok" : "expired"}>
                  {eligible ? "Within return window" : "Window closed"}
                </StatusBadge>
                <StatusBadge tone="info">{r.return_code}</StatusBadge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, status: v as any })}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setOpenQr(openQr === r.id ? null : r.id)}>
                  {openQr === r.id ? "Hide return QR" : "Return QR"}
                </Button>
                {r.purchase_id && (
                  <Link
                    to="/ownership/purchases/$purchaseId"
                    params={{ purchaseId: r.purchase_id }}
                    className="text-xs font-medium underline underline-offset-4"
                  >
                    Purchase
                  </Link>
                )}
              </div>
              {openQr === r.id && (
                <div className="w-40">
                  <QrPreview value={`TAG-RETURN:${r.return_code}`} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
