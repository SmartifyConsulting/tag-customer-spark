import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrPreview } from "@/components/qr/qr-preview";
import { formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/ownership/shared";
import { listReturns, updateReturnStatus } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/returns")({
  head: () => ({
    meta: [
      { title: "Returns — Tag Ownership" },
      { name: "description", content: "Return eligibility, status tracking and scannable return codes." },
    ],
  }),
  component: ReturnsPage,
});

const STATUSES = ["requested", "in_progress", "approved", "rejected", "refunded"] as const;

function ReturnsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReturns);
  const updateFn = useServerFn(updateReturnStatus);
  const [openQr, setOpenQr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["ownership", "returns"], queryFn: () => listFn() });

  const update = useMutation({
    mutationFn: (v: { id: string; status: (typeof STATUSES)[number] }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Return updated");
      qc.invalidateQueries({ queryKey: ["ownership"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the return"),
  });

  const rows = (data as any[]) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Returns"
        description="Start a return from any purchase, then track eligibility and refunds here."
      />

      {isLoading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No returns in progress. Open a purchase and choose “Start return”.
          </CardContent>
        </Card>
      ) : (
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
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenQr(openQr === r.id ? null : r.id)}
                    >
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
      )}
    </div>
  );
}
