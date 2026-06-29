import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Smartphone, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { listProductScans } from "@/lib/qr.functions";
import { deviceLabel } from "@/lib/format";

export function ScansTable({ productId }: { productId: string }) {
  const fn = useServerFn(listProductScans);
  const { data, isLoading } = useQuery({
    queryKey: ["product-scans", productId],
    queryFn: () => fn({ data: { productId, page: 1, pageSize: 50 } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.rows.length) {
    return (
      <EmptyState
        icon={Smartphone}
        title="No scans yet"
        description="When someone scans this product's QR code, the date, store and device will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Store</TableHead>
            <TableHead>Device</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>QR ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((r: any) => {
            const d = new Date(r.scanned_at);
            return (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{d.toLocaleDateString()}</TableCell>
                <TableCell className="text-sm tabular-nums">{d.toLocaleTimeString()}</TableCell>
                <TableCell className="text-sm">{r.store?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{deviceLabel(r.device_type)}</Badge>
                </TableCell>
                <TableCell className="text-sm tabular-nums">v{r.qr_version ?? "?"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.qr_tag?.short_code ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
