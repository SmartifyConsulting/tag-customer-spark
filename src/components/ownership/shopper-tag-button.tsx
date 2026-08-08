import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrPreview } from "@/components/qr/qr-preview";
import { getMyShopperTag } from "@/lib/ownership.functions";

export function ShopperTagButton() {
  const [open, setOpen] = useState(false);
  const tagFn = useServerFn(getMyShopperTag);
  const { data: tagData } = useQuery({ queryKey: ["my-shopper-tag"], queryFn: () => tagFn() });

  // QR payload carries only the tag ID and the account's email — nothing else.
  const qrValue = useMemo(() => {
    if (!tagData?.tagId) return null;
    return JSON.stringify({ tagId: tagData.tagId, email: tagData.email ?? undefined });
  }, [tagData]);

  if (!qrValue) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="My Shopper Tag" onClick={() => setOpen(true)}>
        <Tag className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>My Shopper Tag</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <QrPreview value={qrValue} size={200} />
          <div className="text-center">
            <p className="font-mono text-sm font-semibold">{tagData?.tagId}</p>
            {tagData?.email && <p className="text-xs text-muted-foreground">{tagData.email}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
