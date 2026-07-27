import { useState } from "react";
import { ExternalLink, Printer } from "lucide-react";
import { QrPreview } from "@/components/qr/qr-preview";
import { Button } from "@/components/ui/button";
import { TagReaderCardDialog } from "@/components/settings/tag-reader-card-dialog";

// Compact Tag Barcode Reader frame. Shown in the app header (left side, in
// line with the logo) on the Briefing/Dashboard, and reused in Settings so
// both surfaces always render the same QR target.
export function TagReaderTile({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const readerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tools/barcode-reader`
      : "/tools/barcode-reader";

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 pr-3">
        <QrPreview value={readerUrl} size={compact ? 56 : 96} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold leading-tight">Tag Barcode Reader</p>
          <div className="flex flex-wrap items-center gap-1">
            <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
              <a href={readerUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" /> Open reader
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setOpen(true)}
            >
              <Printer className="mr-1 h-3 w-3" /> Shelf card
            </Button>
          </div>
        </div>
      </div>
      <TagReaderCardDialog open={open} onOpenChange={setOpen} readerUrl={readerUrl} />
    </>
  );
}
