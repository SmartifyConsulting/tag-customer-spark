import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Loader2,
  QrCode as QrIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QrPreview, useQrPngDownload } from "./qr-preview";
import { getPublicScanBase, regenerateProductQr } from "@/lib/qr.functions";
import { renderQrPdf } from "@/lib/qr-pdf.functions";

export type QrTag = {
  id: string;
  short_code: string;
  template: string;
  version: number;
  is_active: boolean;
  created_at: string;
  scan_count?: number;
  last_scanned_at?: string | null;
};

export function ProductQrPanel({
  productId,
  productName,
  tag,
}: {
  productId: string;
  productName: string;
  tag: QrTag | null;
}) {
  const qc = useQueryClient();
  const regen = useServerFn(regenerateProductQr);
  const renderPdf = useServerFn(renderQrPdf);

  const [template, setTemplate] = useState<string>(tag?.template ?? "classic");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: baseData } = useQuery({
    queryKey: ["public-scan-base"],
    queryFn: () => getPublicScanBase(),
    staleTime: Infinity,
  });
  const origin =
    baseData?.base ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const scanBase = `${origin}/api/public/s`;

  const scanUrl = tag ? `${scanBase}/${tag.short_code}` : "";

  const download = useQrPngDownload(scanUrl, `qr-${tag?.short_code ?? productId}`);

  const regenerate = useMutation({
    mutationFn: () => regen({ data: { productId, template: template as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(tag ? "QR regenerated" : "QR generated");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const pdf = useMutation({
    mutationFn: () =>
      renderPdf({
        data: {
          productIds: [productId],
          template: template as any,
          perPage: 1,
          scanBaseUrl: scanBase,
        },
      }),
    onSuccess: (res) => {
      const blob = base64ToBlob(res.base64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: any) => toast.error(e.message ?? "PDF failed"),
  });

  if (!tag) {
    return (
      <div className="grid gap-4 rounded-xl border border-dashed border-border p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-muted">
          <QrIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">No QR code yet</p>
          <p className="text-sm text-muted-foreground">
            Generate a QR code so customers can scan this product in-store.
          </p>
        </div>
        <div className="mx-auto flex items-center gap-2">
          <TemplateSelect value={template} onChange={setTemplate} />
          <Button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
            {regenerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate QR
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 rounded-xl border border-border bg-card p-6 md:grid-cols-[auto_1fr]">
      <QrPreview value={scanUrl} />
      <div className="grid gap-4 self-start">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Scan URL</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="truncate rounded-md bg-muted px-2 py-1 text-xs">{scanUrl}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(scanUrl);
                toast.success("Copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Version" value={`v${tag.version}`} />
          <Stat label="Scans" value={String(tag.scan_count ?? 0)} />
          <Stat label="Template" value={tag.template} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TemplateSelect value={template} onChange={setTemplate} />
          <Button variant="outline" onClick={download}>
            <Download className="mr-2 h-4 w-4" /> PNG
          </Button>
          <Button variant="outline" onClick={() => pdf.mutate()} disabled={pdf.isPending}>
            {pdf.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Printable PDF
          </Button>
          <Button variant="outline" onClick={() => setConfirmOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Regenerating retires the current code. Any printed copies of v{tag.version} will stop tracking new scans.
        </p>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate this QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              A new short code will be issued. The current v{tag.version} code will be retired and stop redirecting after about a minute.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => regenerate.mutate()}>
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}

function TemplateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="classic">Classic</SelectItem>
        <SelectItem value="minimal">Minimal</SelectItem>
        <SelectItem value="bold">Bold promo</SelectItem>
        <SelectItem value="compact">Compact</SelectItem>
      </SelectContent>
    </Select>
  );
}

function base64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}
