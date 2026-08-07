import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, MapPin, Printer, Share2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format";
import { StatusBadge, Timeline, warrantyState } from "@/components/ownership/shared";
import { exportReceiptPdf, printElement, shareText } from "@/components/ownership/export";
import { getPurchase, startReturn } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/purchases/$purchaseId")({
  head: () => ({
    meta: [
      { title: "Purchase detail — Tag Ownership" },
      { name: "description", content: "Receipt, basket, store details and ownership timeline." },
    ],
  }),
  component: PurchaseDetail,
});

function PurchaseDetail() {
  const { purchaseId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getPurchase);
  const returnFn = useServerFn(startReturn);
  const [reason, setReason] = useState("");
  const [returnItemId, setReturnItemId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "purchase", purchaseId],
    queryFn: () => getFn({ data: { id: purchaseId } }),
  });

  const begin = useMutation({
    mutationFn: (itemId: string) =>
      returnFn({ data: { purchaseId, purchaseItemId: itemId, reason: reason || "Not specified" } }),
    onSuccess: (r: any) => {
      toast[r?.eligible ? "success" : "warning"](
        r?.eligible
          ? `Return ${r.return_code} started`
          : `Outside the return window — logged as ${r?.return_code} for review`,
      );
      setReturnItemId(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["ownership"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not start the return"),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  const p = data as any;
  if (!p) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          That purchase is not available.
        </CardContent>
      </Card>
    );
  }

  const items = (p.items ?? []) as any[];
  const currency = p.currency ?? "ZAR";
  const firstWarranty = Object.values(p.warrantyByItem ?? {}).filter(Boolean)[0] as any;
  const windowEnds = (() => {
    const d = new Date(p.purchased_at);
    d.setDate(d.getDate() + (items[0]?.return_window_days ?? 30));
    return d.toISOString();
  })();

  const receiptHtml = `<h2>${p.store?.name ?? "Store"}</h2><p>Receipt ${p.receipt_number ?? ""}<br/>${new Date(
    p.purchased_at,
  ).toLocaleString()}</p><table>${items
    .map(
      (i) =>
        `<tr><td>${i.quantity} × ${i.name}</td><td align="right">${formatMoney(
          i.line_total_cents,
          currency,
        )}</td></tr>`,
    )
    .join("")}<tr><td><b>Total</b></td><td align="right"><b>${formatMoney(
    p.total_cents,
    currency,
  )}</b></td></tr></table>`;

  return (
    <div className="space-y-6">
      <Link
        to="/ownership/purchases"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Purchases
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Purchase summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Retailer" value={p.store?.name ?? "—"} />
              <Field label="Purchase date" value={new Date(p.purchased_at).toLocaleString()} />
              <Field label="Total paid" value={formatMoney(p.total_cents, currency)} />
              <Field label="Quantity" value={String(items.reduce((s, i) => s + i.quantity, 0))} />
              <Field label="Payment method" value={p.payment_method ?? "—"} />
              <Field label="Receipt number" value={p.receipt_number ?? "—"} />
              <Field label="TAG ID" value={p.tag?.tag_id ?? "—"} />
              <Field
                label="Warranty"
                value={warrantyState(firstWarranty?.expires_on).label}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>Basket</CardTitle>
              <span className="text-sm text-muted-foreground">{items.length} items</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((i) => {
                const w = p.warrantyByItem?.[i.id];
                return (
                  <div key={i.id} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      {i.image_url && (
                        <img
                          src={i.image_url}
                          alt={i.name}
                          loading="lazy"
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{i.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.brand ? `${i.brand} · ` : ""}
                          {i.category ?? "Uncategorised"} · Qty {i.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        {formatMoney(i.line_total_cents, currency)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {w && <StatusBadge tone={warrantyState(w.expires_on).tone}>Warranty {warrantyState(w.expires_on).label}</StatusBadge>}
                      {p.ownedByItem?.[i.id] && (
                        <Link
                          to="/ownership/products/$productId"
                          params={{ productId: p.ownedByItem[i.id] }}
                          className="text-xs font-medium underline underline-offset-4"
                        >
                          Open ownership profile
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => setReturnItemId(returnItemId === i.id ? null : i.id)}
                      >
                        <Undo2 className="mr-1.5 h-4 w-4" /> Start return
                      </Button>
                    </div>
                    {returnItemId === i.id && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Reason for return"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <Button size="sm" disabled={begin.isPending} onClick={() => begin.mutate(i.id)}>
                          Submit
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {(p.returns ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Returns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.returns.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>
                      {r.return_code} · {r.reason}
                    </span>
                    <StatusBadge tone={r.status === "refunded" ? "ok" : "soon"}>{r.status}</StatusBadge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Digital receipt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 font-mono text-xs">
                <p className="mb-2 text-center font-semibold">{p.store?.name ?? "Store"}</p>
                {items.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span className="truncate pr-2">
                      {i.quantity} × {i.name}
                    </span>
                    <span>{formatMoney(i.line_total_cents, currency)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(p.total_cents, currency)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportReceiptPdf({
                      receiptNumber: p.receipt_number ?? "receipt",
                      storeName: p.store?.name ?? "Store",
                      date: p.purchased_at,
                      paymentMethod: p.payment_method,
                      currency,
                      totalCents: p.total_cents,
                      items: items.map((i) => ({
                        name: i.name,
                        quantity: i.quantity,
                        lineTotalCents: i.line_total_cents,
                      })),
                    })
                  }
                >
                  <Download className="mr-1.5 h-4 w-4" /> PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    shareText(
                      `Receipt ${p.receipt_number}`,
                      `${p.store?.name} — ${formatMoney(p.total_cents, currency)} on ${new Date(
                        p.purchased_at,
                      ).toLocaleDateString()}`,
                    ).then(() => toast.success("Receipt shared"))
                  }
                >
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printElement(receiptHtml, `Receipt ${p.receipt_number}`)}
                >
                  <Printer className="mr-1.5 h-4 w-4" /> Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rows = items.map((i) => ({
                      receipt: p.receipt_number,
                      item: i.name,
                      qty: i.quantity,
                      total: i.line_total_cents / 100,
                    }));
                    import("@/components/ownership/export").then((m) =>
                      m.exportCsv(rows, `${p.receipt_number}.csv`),
                    );
                  }}
                >
                  <Download className="mr-1.5 h-4 w-4" /> Export
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Store information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{p.store?.name ?? "—"}</p>
              <p className="text-muted-foreground">
                {[p.store?.address, p.store?.city, p.store?.province].filter(Boolean).join(", ") || "—"}
              </p>
              {p.store?.phone && <p className="text-muted-foreground">{p.store.phone}</p>}
              {p.store?.name && (
                <a
                  className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/search/${encodeURIComponent(
                    [p.store.name, p.store.address, p.store.city].filter(Boolean).join(" "),
                  )}`}
                >
                  <MapPin className="h-4 w-4" /> View on map
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                steps={[
                  { label: "Purchase", date: p.purchased_at, done: true },
                  {
                    label: "Warranty started",
                    date: firstWarranty?.starts_on ?? p.purchased_at,
                    done: !!firstWarranty,
                  },
                  {
                    label: "Return window ends",
                    date: windowEnds,
                    done: new Date(windowEnds).getTime() < Date.now(),
                  },
                  {
                    label: "Warranty expires",
                    date: firstWarranty?.expires_on ?? null,
                    done: firstWarranty
                      ? new Date(firstWarranty.expires_on).getTime() < Date.now()
                      : false,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
