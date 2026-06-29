import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, FileDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderQrPdf } from "@/lib/qr-pdf.functions";
import { bulkGenerateQrs } from "@/lib/qr.functions";

export function BulkQrDialog({
  open,
  onOpenChange,
  productIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productIds: string[];
}) {
  const [template, setTemplate] = useState("classic");
  const [perPage, setPerPage] = useState<1 | 2 | 4 | 8>(4);
  const [message, setMessage] = useState(
    "Love this item? Scan here to receive WhatsApp updates if the price drops.",
  );
  const renderPdf = useServerFn(renderQrPdf);
  const bulkGen = useServerFn(bulkGenerateQrs);

  const scanBase = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/s`
    : "/api/public/s";

  const run = useMutation({
    mutationFn: async () => {
      await bulkGen({ data: { productIds, template: template as any, regenerate: false } });
      return renderPdf({
        data: {
          productIds,
          template: template as any,
          perPage,
          message,
          scanBaseUrl: scanBase,
        },
      });
    },
    onSuccess: (res) => {
      const bin = atob(res.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      onOpenChange(false);
      toast.success(`Generated ${productIds.length} card${productIds.length === 1 ? "" : "s"}`);
    },
    onError: (e: any) => toast.error(e.message ?? "PDF failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk QR cards</DialogTitle>
          <DialogDescription>
            Generates QR tags for the selected products (skipped if already active) and downloads an A4 PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="bold">Bold promo</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Cards per A4 page</Label>
            <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v) as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 (full page)</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="8">8</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Short message</Label>
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">
              {productIds.length} product{productIds.length === 1 ? "" : "s"} selected.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => run.mutate()} disabled={run.isPending || productIds.length === 0}>
            {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
