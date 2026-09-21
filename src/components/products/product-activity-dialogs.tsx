import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listProductScans } from "@/lib/qr.functions";
import { listProductFollowers } from "@/lib/products.functions";
import { deviceLabel } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
};

const SCAN_PAGE = 50;

// The list behind the "Tagged · N" badge: one row per scan of the product's QR.
// Scans are anonymous unless one was linked to a customer, so "Who" is only
// filled in when that link exists — nothing is inferred.
export function TaggedDialog({ open, onOpenChange, productId, productName }: Props) {
  const fn = useServerFn(listProductScans);
  const q = useInfiniteQuery({
    queryKey: ["product-tags", productId],
    enabled: open,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fn({ data: { productId, page: pageParam, pageSize: SCAN_PAGE } }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {productName} — tagged {total} time{total === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>Each row is one scan of this product's QR code.</DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <p className="text-sm text-destructive">Couldn't load scans. Please try again.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scans yet.</p>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Who</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const d = new Date(r.scanned_at);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{d.toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm tabular-nums">{d.toLocaleTimeString()}</TableCell>
                      <TableCell className="text-sm">{r.store?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{deviceLabel(r.device_type)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.customer_name ?? <span className="text-muted-foreground">Not identified</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {rows.length > 0 ? `Showing ${rows.length} of ${total}` : ""}
          </span>
          <div className="flex gap-2">
            {q.hasNextPage && (
              <Button variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  scan: "QR scan",
  barcode_scan: "Barcode page",
  manual: "Added by staff",
  import: "Import",
};

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// The list behind the "N following" badge: customers with an active interest.
export function FollowingDialog({ open, onOpenChange, productId, productName }: Props) {
  const fn = useServerFn(listProductFollowers);
  const q = useQuery({
    queryKey: ["product-followers", productId],
    enabled: open,
    queryFn: () => fn({ data: { productId } }),
  });
  const rows = q.data?.rows ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {productName} — {q.data ? rows.length : ""} following
          </DialogTitle>
          <DialogDescription>Customers who asked for WhatsApp updates on this product.</DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <p className="text-sm text-destructive">Couldn't load followers. Please try again.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is following this product yet.</p>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Name</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Following since</TableHead>
                  <TableHead>How</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {r.name ?? <span className="text-muted-foreground">(no name)</span>}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{r.whatsapp ?? "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(r.followed_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sourceLabel(r.source)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center p-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
