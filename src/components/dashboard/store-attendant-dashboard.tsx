import { useServerFn } from "@tanstack/react-start";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { QrCode, Users, MessageSquare, Package, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { IntentSectionsCard } from "@/components/dashboard/intent-sections-card";
import { listProducts } from "@/lib/products.functions";
import { listConversations } from "@/lib/inbox.functions";
import { dashboardOverviewQueryOptions } from "@/lib/dashboard";

// Store-floor view for sales assistants: today's activity at a glance plus
// the two things they actually act on day to day (what's low on the shelf,
// who's waiting for a reply) — not the executive revenue/ROI dashboard,
// which assumes a manager's cross-store vantage point.
export function StoreAttendantDashboard({ storeId }: { storeId: string | null }) {
  const { data } = useSuspenseQuery(dashboardOverviewQueryOptions);
  const k = data.kpis;

  const listProductsFn = useServerFn(listProducts);
  const listConversationsFn = useServerFn(listConversations);

  const lowStock = useQuery({
    queryKey: ["store-dashboard", "low-stock", storeId],
    queryFn: () =>
      listProductsFn({
        data: { low_stock: true, store_id: storeId ?? undefined, pageSize: 6, sort: "stock" },
      }),
  });

  const unread = useQuery({
    queryKey: ["store-dashboard", "unread-messages"],
    queryFn: () => listConversationsFn({ data: { scope: "unread" } }),
  });

  const messagesCount = unread.data?.length ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard index={0} label="Today's scans" value={k.todaysScans} icon={QrCode} />
        <KpiCard index={1} label="Customers waiting" value={k.customersWaiting} icon={Users} tone="success" />
        <KpiCard index={2} label="Messages count" value={messagesCount} icon={MessageSquare} tone={messagesCount > 0 ? "warning" : "default"} />
      </div>

      <IntentSectionsCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" /> Inventory — needs attention
            </CardTitle>
            <CardDescription>Products running low on stock.</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !lowStock.data?.rows?.length ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nothing low on stock right now.
              </div>
            ) : (
              <ul className="space-y-1">
                {lowStock.data.rows.map((p: any) => (
                  <li key={p.id}>
                    <Link
                      to="/admin/inventory/$productId"
                      params={{ productId: p.id }}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition"
                    >
                      <span className="truncate text-sm">{p.name}</span>
                      <Badge variant={p.stock_qty === 0 ? "destructive" : "secondary"} className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {p.stock_qty} left
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/admin/inventory" className="mt-3 block text-center text-sm font-medium text-primary hover:underline">
              View full inventory
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" /> Messages — unread
            </CardTitle>
            <CardDescription>Customers waiting on a reply.</CardDescription>
          </CardHeader>
          <CardContent>
            {unread.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !unread.data?.length ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No unread messages.
              </div>
            ) : (
              <ul className="space-y-1">
                {unread.data.slice(0, 6).map((c: any) => (
                  <li key={c.id}>
                    <Link
                      to="/inbox"
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition"
                    >
                      <span className="truncate text-sm">
                        {c.customer?.full_name ?? c.customer?.whatsapp_e164 ?? "Customer"}
                      </span>
                      <Badge className="bg-[color:var(--mint)] text-white hover:bg-[color:var(--mint)]">
                        {c.unread_count}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/inbox" className="mt-3 block text-center text-sm font-medium text-primary hover:underline">
              Open Messages
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
