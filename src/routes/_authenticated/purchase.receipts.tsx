import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, Download, FileSpreadsheet, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptStatusBadge, StatusBadge } from "@/components/ownership/shared";
import { exportCsv, exportExcel, exportTablePdf } from "@/components/ownership/export";
import { formatMoney } from "@/lib/format";
import { listReceipts, updateReceipt } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/purchase/receipts")({
  head: () => ({
    meta: [
      { title: "Digital Receipts — Tag Purchase" },
      {
        name: "description",
        content: "Every digital receipt issued to this TAG ID — favourite, archive and export.",
      },
      { property: "og:title", content: "Digital Receipts — Tag Purchase" },
      {
        property: "og:description",
        content: "Every digital receipt issued to this TAG ID — favourite, archive and export.",
      },
    ],
  }),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const listFn = useServerFn(listReceipts);
  const updateFn = useServerFn(updateReceipt);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "receipts"],
    queryFn: () => listFn(),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; isFavourite?: boolean; isArchived?: boolean }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ownership", "receipts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the receipt"),
  });

  const receipts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return ((data as any[]) ?? []).filter((r) => {
      if (!showArchived && r.is_archived) return false;
      if (!term) return true;
      const haystack = [
        r.receipt_number,
        r.category,
        r.purchase?.store?.name,
        ...((r.purchase?.items ?? []) as any[]).map((i) => i.product_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, query, showArchived]);

  const exportRows = () =>
    receipts.map((r: any) => ({
      receipt_number: r.receipt_number,
      issued: r.issued_at ? String(r.issued_at).slice(0, 10) : "",
      store: r.purchase?.store?.name ?? "",
      category: r.category ?? "",
      total: (r.purchase?.total_cents ?? 0) / 100,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Digital Receipts"
        description="Proof of purchase without paper — searchable, exportable and permanently linked to the TAG ID."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => exportCsv(exportRows(), "receipts.csv")}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportExcel(exportRows(), "receipts.xlsx", "Receipts")}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportTablePdf("Digital receipts", exportRows(), "receipts.pdf")}
            >
              PDF
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipts, stores or products"
            className="pl-9"
          />
        </div>
        <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)}>
          <Archive className="mr-1.5 h-4 w-4" /> {showArchived ? "Showing archived" : "Hide archived"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : receipts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No digital receipts yet. Receipts appear here the moment a purchase is captured against a TAG ID.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {receipts.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.receipt_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.purchase?.store?.name ?? "Store"} ·{" "}
                    {r.issued_at ? new Date(r.issued_at).toLocaleDateString() : "—"} ·{" "}
                    {(r.purchase?.items ?? []).length} item(s)
                  </p>
                </div>
                <ReceiptStatusBadge status={r.status} />
                {r.category && <StatusBadge tone="info">{r.category}</StatusBadge>}
                {r.is_archived && <StatusBadge tone="muted">Archived</StatusBadge>}
                <p className="font-semibold">{formatMoney(r.purchase?.total_cents ?? 0)}</p>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Favourite receipt"
                    onClick={() => update.mutate({ id: r.id, isFavourite: !r.is_favourite })}
                  >
                    <Star className={r.is_favourite ? "h-4 w-4 fill-current text-amber-500" : "h-4 w-4"} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Archive receipt"
                    onClick={() => update.mutate({ id: r.id, isArchived: !r.is_archived })}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
