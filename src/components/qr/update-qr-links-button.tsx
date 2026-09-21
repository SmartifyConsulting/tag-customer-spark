import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { countStaleQrs, migrateStaleQrs } from "@/lib/qr.functions";

// Moves QR codes printed before the domain change (which encode a retired
// web address) onto the current one. Hidden when nothing needs updating.
export function UpdateQrLinksButton() {
  const countFn = useServerFn(countStaleQrs);
  const migrateFn = useServerFn(migrateStaleQrs);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data, refetch } = useQuery({
    queryKey: ["stale-qr-count"],
    queryFn: () => countFn(),
    staleTime: 60_000,
    retry: false,
  });
  const count = data?.count ?? 0;
  if (count === 0 && !running) return null;

  const run = async () => {
    setRunning(true);
    setProgress(0);
    let updated = 0;
    const failed = new Map<string, string>();
    try {
      // Batches keep each request short; failed products are excluded from
      // later batches so they can't block the rest.
      for (;;) {
        const res = await migrateFn({ data: { exclude: Array.from(failed.keys()) } });
        updated += res.updated;
        res.failed.forEach((f) => failed.set(f.productId, f.message));
        setProgress(updated);
        if (res.updated === 0 && res.failed.length === 0) break;
        if (res.remaining <= 0) break;
      }
      qc.invalidateQueries();
      await refetch();
      setOpen(false);
      if (failed.size === 0) {
        toast.success(
          `Updated ${updated} QR code${updated === 1 ? "" : "s"}. Reprint their stickers from the product's QR panel.`,
        );
      } else {
        const first = Array.from(failed.values())[0];
        toast.warning(
          `Updated ${updated}, ${failed.size} could not be updated (e.g. ${first}). Reprint stickers for the updated ones from the product's QR panel.`,
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update QR links");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <QrCode className="mr-2 h-4 w-4" /> Update QR links ({count})
      </Button>
      <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update QR links to tag-tech.co.za</DialogTitle>
            <DialogDescription>
              {count} product QR code{count === 1 ? "" : "s"} still use an old web address that no longer works,
              so scanning {count === 1 ? "it doesn't" : "them doesn't"} open anything.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            We'll create a new QR for each one that points to tag-tech.co.za. The old QR is retired. You'll need to
            print and replace the stickers for these products — printed stickers can't be changed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              Cancel
            </Button>
            <Button onClick={run} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating… {progress} / {count}
                </>
              ) : (
                `Update ${count} QR code${count === 1 ? "" : "s"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
