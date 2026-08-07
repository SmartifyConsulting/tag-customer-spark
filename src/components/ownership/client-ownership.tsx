import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { ReceiptStatusBadge, StatusBadge, warrantyState } from "@/components/ownership/shared";
import { clientOwnership } from "@/lib/ownership.functions";

/**
 * The customer's own record, seen from the retail side: the same purchases,
 * receipts, owned products, returns and warranties the shopper sees.
 */
export function ClientOwnershipTabs({ customerId }: { customerId: string }) {
  const fn = useServerFn(clientOwnership);
  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "client", customerId],
    queryFn: () => fn({ data: { customerId } }),
  });

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  const d = data as any;
  if (!d || !d.tagIds?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No TAG ID linked yet — purchases recorded against a TAG ID appear here.
      </p>
    );
  }

  return (
    <Tabs defaultValue="purchases">
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="purchases">Purchases</TabsTrigger>
        <TabsTrigger value="receipts">Receipts</TabsTrigger>
        <TabsTrigger value="owned">Owned</TabsTrigger>
        <TabsTrigger value="returns">Returns</TabsTrigger>
        <TabsTrigger value="warranties">Warranty</TabsTrigger>
      </TabsList>

      <TabsContent value="purchases" className="mt-3 space-y-2">
        {d.purchases.length === 0 && <Empty>No purchases yet.</Empty>}
        {d.purchases.map((p: any) => (
          <Link
            key={p.id}
            to="/ownership/purchases/$purchaseId"
            params={{ purchaseId: p.id }}
            className="flex items-center justify-between rounded-lg border p-2 text-sm hover:bg-muted/40"
          >
            <span className="truncate">
              {p.receipt_number ?? "Purchase"} · {p.store?.name ?? "Store"}
            </span>
            <span className="font-medium">{formatMoney(p.total_cents ?? 0)}</span>
          </Link>
        ))}
      </TabsContent>

      <TabsContent value="receipts" className="mt-3 space-y-2">
        {d.receipts.length === 0 && <Empty>No receipts yet.</Empty>}
        {d.receipts.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
            <span className="truncate">{r.receipt_number}</span>
            <ReceiptStatusBadge status={r.status} />
          </div>
        ))}
      </TabsContent>

      <TabsContent value="owned" className="mt-3 space-y-2">
        {d.owned.length === 0 && <Empty>Nothing owned yet.</Empty>}
        {d.owned.map((o: any) => (
          <Link
            key={o.id}
            to="/ownership/products/$productId"
            params={{ productId: o.id }}
            className="flex items-center justify-between rounded-lg border p-2 text-sm hover:bg-muted/40"
          >
            <span className="truncate">{o.name}</span>
            <StatusBadge tone={warrantyState(o.warranty?.expires_on).tone}>
              {warrantyState(o.warranty?.expires_on).label}
            </StatusBadge>
          </Link>
        ))}
      </TabsContent>

      <TabsContent value="returns" className="mt-3 space-y-2">
        {d.returns.length === 0 && <Empty>No returns.</Empty>}
        {d.returns.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
            <span className="truncate">{r.item?.name ?? r.return_code}</span>
            <StatusBadge tone={r.status === "refunded" ? "ok" : "info"}>{r.status}</StatusBadge>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="warranties" className="mt-3 space-y-2">
        {d.warranties.length === 0 && <Empty>No warranties registered.</Empty>}
        {d.warranties.map((w: any) => (
          <div key={w.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
            <span className="truncate">{w.product?.name}</span>
            <StatusBadge tone={warrantyState(w.expires_on).tone}>
              {warrantyState(w.expires_on).label}
            </StatusBadge>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
