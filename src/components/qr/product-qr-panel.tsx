import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listStores } from "@/lib/stores.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Check,
  Download,
  ExternalLink,
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
  store_id: string | null;
  store_name: string | null;
};

export function ProductQrPanel({
  productId,
  productName,
  qr,
  dppId,
  defaultStoreId,
}: {
  productId: string;
  productName: string;
  qr: ActiveQrAsset | null;
  dppId?: string | null;
  /** Store on the product record — used as the default QR attribution. */
  defaultStoreId?: string | null;
}) {
  const qc = useQueryClient();
  const generateFn = useServerFn(generateProductQr);
  const listStoresFn = useServerFn(listStores);
  const storesQ = useQuery({ queryKey: ["stores"], queryFn: () => listStoresFn() });
  const stores: Array<{ id: string; name: string }> = (storesQ.data as any)?.stores ?? [];
  const [storeId, setStoreId] = useState<string | null>(
    qr?.store_id ?? defaultStoreId ?? null,
  );
  const [confirmRegen, setConfirmRegen] = useState(false);

  // Store attribution is required, not optional — a scan needs to trace
  // back to the physical store the item was in, even for a single-store
  // retailer, so default to a real store rather than leaving it unset.
  useEffect(() => {
    if (!storeId && stores.length > 0) setStoreId(stores[0].id);
  }, [stores, storeId]);

  const generate = useMutation({
    mutationFn: (force: boolean) =>
      generateFn({
        data: { productId, force, storeId: storeId ?? qr?.store_id ?? defaultStoreId ?? null },
      }),
    onSuccess: (row: any) => {
      qc.setQueryData(["product", productId], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, qr: row };
      });
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("GS1 QR Code successfully generated.");
    },
    onError: (e: any) => {
      toast.error(e.message ?? "QR generation failed");
    },
  });

  if (!qr) {
    return (
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
          <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
            {stores.length > 1 && (
              <Select value={storeId ?? undefined} onValueChange={(v) => setStoreId(v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Store attribution…" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={() => generate.mutate(false)}
              disabled={generate.isPending || (stores.length > 0 && !storeId)}
            >
              {generate.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <QrIcon className="mr-2 h-4 w-4" />
              )}
              Generate QR
            </Button>
          </div>
          {stores.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Pick the branch that will print this card so scans attribute the customer's opt-in to that store.
            </p>
          )}
        </div>
      </section>
    );
  }

  const generatedDate = new Date(qr.generated_at).toLocaleString();
  const dppHref = dppId ? `/p/${dppId}` : qr.resolver_url;
  const storeCode = qr.store_id ? `STORE-${qr.store_id.slice(0, 8).toUpperCase()}` : null;

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">GS1 Digital Link QR</h2>
          <p className="text-xs text-muted-foreground">Active QR code for this product.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
        </Button>
      </header>

      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          QR Code
        </p>
        <div
          className="grid place-items-center rounded-xl border border-border bg-white p-2"
          style={{ width: 176, height: 176 }}
        >
          <img src={qr.svg_url} alt={`QR for ${productName}`} className="h-[156px] w-[156px]" />
        </div>
        <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
          <Check className="h-3 w-3" /> Active
        </Badge>
        <div className="w-full max-w-[260px] space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="break-words font-mono text-sm font-semibold">
            {qr.gtin} · v{qr.version}
          </p>
          <p className="text-xs text-muted-foreground">{generatedDate}</p>
          <p className="text-xs">
            {qr.store_name ? (
              <span className="font-medium text-foreground">
                Tagged at {qr.store_name}
                {storeCode ? <span className="text-muted-foreground"> · {storeCode}</span> : null}
              </span>
            ) : (
              <span className="font-medium text-amber-600">Store not assigned</span>
            )}
          </p>
          <p className="break-all text-xs text-muted-foreground">{qr.resolver_url}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              navigator.clipboard?.writeText(qr.digital_link_url);
              toast.success("Digital Link copied");
            }}
          >
            Copy GS1 Digital Link
          </Button>
        </div>
      </div>

      {/* Reassign the branch this QR belongs to — regenerating with a
          different store stamps the new store_id/store_name onto the asset. */}
      {stores.length > 1 && (
        <div className="grid gap-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Reassign store
          </p>
          <Select value={storeId ?? undefined} onValueChange={(v) => setStoreId(v)}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Pick a branch…" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={generate.isPending || !storeId || storeId === qr.store_id}
            onClick={() => generate.mutate(true)}
          >
            {generate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Assign store to QR
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => download(qr.png_url, `qr-${qr.gtin}.png`)}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => download(qr.svg_url, `qr-${qr.gtin}.svg`)}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> SVG
        </Button>
        <Button variant="outline" size="sm" onClick={() => printQr(qr.png_url, productName, qr.gtin)}>
          <Printer className="mr-1.5 h-3.5 w-3.5" /> Print QR
        </Button>
        <a
          href={dppHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Digital ID
        </a>
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
