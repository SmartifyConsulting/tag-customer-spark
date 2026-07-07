import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Send } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getNotificationTypePerformance } from "@/lib/dashboard.functions";

export function NotificationPerformanceCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "notification-type-performance"],
    queryFn: () => getNotificationTypePerformance(),
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const totalSent = rows.reduce((s, r) => s + r.sent, 0);

  return (
    <Card
      className="rounded-2xl animate-fade-in"
      style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
    >
      <CardHeader>
        <CardTitle className="text-base font-semibold">Notification performance</CardTitle>
        <p className="text-xs text-muted-foreground">
          Stock-back and price-drop alerts sent to customers who scanned these items.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : totalSent === 0 ? (
          <EmptyState
            icon={Send}
            title="No notifications sent yet"
            description="Once stock or price changes trigger customer alerts, they'll appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Alert type</TableHead>
                <TableHead className="text-right text-xs">Sent</TableHead>
                <TableHead className="text-right text-xs">Delivered</TableHead>
                <TableHead className="text-right text-xs">Read</TableHead>
                <TableHead className="text-right text-xs">Clicked</TableHead>
                <TableHead className="text-right text-xs">Redeemed</TableHead>
                <TableHead className="text-right text-xs">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.type}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.sent}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.delivered}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.read}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.clicked}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.redeemed}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.ctr}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
