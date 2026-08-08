import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrPreview } from "@/components/qr/qr-preview";
import { getTagIdentity } from "@/lib/ownership.functions";

export function ShopperTagButton() {
  const [open, setOpen] = useState(false);
  const tagFn = useServerFn(getTagIdentity);
  const { data: tagData } = useQuery({ queryKey: ["tag-identity"], queryFn: () => tagFn() });

  if (!tagData?.tag_id) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="My Shopper Tag" onClick={() => setOpen(true)}>
        <Tag className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>My Shopper Tag</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <QrPreview value={tagData.tag_id} size={200} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
