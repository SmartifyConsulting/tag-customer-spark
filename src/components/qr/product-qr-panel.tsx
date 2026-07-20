import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  Download,
  ExternalLink,
  GitMerge,
  Loader2,
  Printer,
  QrCode as QrIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { generateProductQr } from "@/lib/qr.functions";
import { MergeProductsSearchDialog } from "@/components/settings/merge-products-search-dialog";

export type ActiveQrAsset = {
  id: string;
  product_id: string;
  gtin: string;
  status: string;
  version: number;
  generated_at: string;
  resolver_url: string;
  digital_link_url: string;
  png_url: string;
  svg_url: string;
};

type GtinClash = {
  gtin: string;
  otherProductId: string;
  otherProductName: string;
  otherProductSku: string | null;
};

function parseClash(message: string): GtinClash | null {
  try {
    const parsed = JSON.parse(message);
    if (parsed?.code === "GTIN_CLASH") return parsed as GtinClash;
  } catch {
    /* not a structured error */
  }
  return null;
}

export function ProductQrPanel({
  productId,
  productName,
  qr,
  dppId,
}: {
  productId: string;
  productName: string;
  qr: ActiveQrAsset | null;
  dppId?: string | null;
}) {
  const qc = useQueryClient();
  const generateFn = useServerFn(generateProductQr);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [clash, setClash] = useState<GtinClash | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [autoRetryAfterMerge, setAutoRetryAfterMerge] = useState(false);

  const generate = useMutation({
    mutationFn: (force: boolean) => generateFn({ data: { productId, force } }),
    onSuccess: (row: any) => {
      qc.setQueryData(["product", productId], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, qr: row };
      });
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("GS1 QR Code successfully generated.");
    },
    onError: (e: any) => {
      const parsed = parseClash(e?.message ?? "");
      if (parsed) {
        setClash(parsed);
        return;
      }
      toast.error(e.message ?? "QR generation failed");
    },
  });


  const clashDialogs = (
    <>
      <AlertDialog open={!!clash} onOpenChange={(v) => !v && setClash(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate GTIN detected</AlertDialogTitle>
            <AlertDialogDescription>
              GTIN <code className="rounded bg-muted px-1 py-0.5 text-xs">{clash?.gtin}</code>{" "}
              already has an active QR code on{" "}
              <strong>{clash?.otherProductName}</strong>
              {clash?.otherProductSku ? ` (${clash.otherProductSku})` : ""}. These look like
              duplicate product records. Merge them — <strong>{productName}</strong> will survive
              and its QR will be generated automatically after the merge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAutoRetryAfterMerge(true);
                setMergeOpen(true);
                setClash(null);
              }}
            >
              <GitMerge className="mr-2 h-4 w-4" /> Merge duplicates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MergeProductsSearchDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        initialSearch={clash?.gtin ?? ""}
        initialTargetId={productId}
        initialPreselected={
          clash
            ? [
                { id: productId, name: productName },
                { id: clash.otherProductId, name: clash.otherProductName, sku: clash.otherProductSku },
              ]
            : [{ id: productId, name: productName }]
        }
        onMerged={() => {
          qc.invalidateQueries({ queryKey: ["product", productId] });
          if (autoRetryAfterMerge) {
            setAutoRetryAfterMerge(false);
            generate.mutate(false);
          }
        }}
      />
    </>
  );

  if (!qr) {
    return (
      <>
        <section className="grid gap-4 rounded-xl border border-border bg-card p-6">
          <header className="flex items-center gap-2">
            <QrIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              QR status
            </h2>
          </header>
          <div className="grid gap-4 rounded-xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-muted">
              <QrIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No QR yet for this product.</p>
              <p className="text-sm text-muted-foreground">
                Generate a GS1 Digital Link QR that preserves the product's GTIN.
              </p>
            </div>
            <div className="mx-auto">
              <Button onClick={() => generate.mutate(false)} disabled={generate.isPending}>
                {generate.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <QrIcon className="mr-2 h-4 w-4" />
                )}
                Generate QR
              </Button>
            </div>
          </div>
        </section>
        {clashDialogs}
      </>
    );
  }


  const generatedDate = new Date(qr.generated_at).toLocaleString();
  const dppHref = dppId ? `/p/${dppId}` : qr.resolver_url;

  return (
    <section className="grid gap-6 rounded-xl border border-border bg-card p-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="grid place-items-center rounded-xl border border-border bg-white p-3"
          style={{ width: 220, height: 220 }}
        >
          <img src={qr.svg_url} alt={`QR for ${productName}`} className="h-[196px] w-[196px]" />
        </div>
        <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
          <Check className="h-3 w-3" /> Active
        </Badge>
      </div>
      <div className="grid content-start gap-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">GS1 Digital Link QR</h2>
            <p className="text-sm text-muted-foreground">
              This product already has an active QR Code.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GTIN · Version</p>
          <p className="mt-0.5 break-words font-mono text-sm font-medium">
            {qr.gtin} · v{qr.version}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Generated {generatedDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => download(qr.png_url, `qr-${qr.gtin}.png`)}>
            <Download className="mr-2 h-4 w-4" /> Download PNG
          </Button>
          <Button variant="outline" onClick={() => download(qr.svg_url, `qr-${qr.gtin}.svg`)}>
            <Download className="mr-2 h-4 w-4" /> Download SVG
          </Button>
          <Button variant="outline" onClick={() => printQr(qr.png_url, productName, qr.gtin)}>
            <Printer className="mr-2 h-4 w-4" /> Print QR
          </Button>
          <a
            href={dppHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" /> View Digital ID
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Resolver URL:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{qr.resolver_url}</code>
        </p>
      </div>
      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate this QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              The current v{qr.version} QR is retired and replaced by v{qr.version + 1}. Printed
              copies of the old artwork will still resolve to the same product because the GTIN
              stays the same.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRegen(false);
                generate.mutate(true);
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 break-words font-medium ${mono ? "font-mono text-sm" : ""}`}>{value}</p>
    </div>
  );
}

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function printQr(pngUrl: string, name: string, gtin: string) {
  const w = window.open("", "_blank", "width=520,height=640");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>QR — ${escapeHtml(name)}</title>
  <style>body{font-family:system-ui,sans-serif;text-align:center;padding:32px}
  img{width:340px;height:340px}h1{font-size:18px;margin:16px 0 4px}p{color:#555;margin:2px 0}
  </style></head><body>
  <img src="${pngUrl}" alt="QR" onload="setTimeout(()=>window.print(),200)"/>
  <h1>${escapeHtml(name)}</h1><p>GTIN: ${escapeHtml(gtin)}</p>
  </body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
