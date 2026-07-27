import { useState } from "react";
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
  store_id?: string | null;
  store_name?: string | null;
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
  const listStoresFn = useServerFn(listStores);
  const storesQ = useQuery({ queryKey: ["stores"], queryFn: () => listStoresFn() });
  const stores: Array<{ id: string; name: string }> = (storesQ.data as any)?.stores ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [clash, setClash] = useState<GtinClash | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [autoRetryAfterMerge, setAutoRetryAfterMerge] = useState(false);

  const generate = useMutation({
    mutationFn: (force: boolean) => generateFn({ data: { productId, force, storeId } }),

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
            <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
              {stores.length > 1 && (
                <Select value={storeId ?? "__none__"} onValueChange={(v) => setStoreId(v === "__none__" ? null : v)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Store attribution…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All stores (no attribution)</SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => generate.mutate(false)} disabled={generate.isPending}>
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
        {clashDialogs}
      </>
    );
  }


  const generatedDate = new Date(qr.generated_at).toLocaleString();
  const dppHref = dppId ? `/p/${dppId}` : qr.resolver_url;
  const storeCode = qr.store_id ? `TAG-${qr.store_id.slice(0, 8).toUpperCase()}` : null;

  return (
    <>
    <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">GS1 Digital Link QR</h2>
          <p className="text-xs text-muted-foreground">
            This product already has an active QR Code.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
        </Button>
      </header>

      {/* QR + Active badge, with the GS1 Digital Link details neatly stacked
          directly underneath so nothing is clipped by the outer frame. */}
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

      <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          GS1 Digital Link
        </p>
        <p className="mt-1 break-all font-mono text-[11px] leading-relaxed">
          {qr.digital_link_url}
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          Resolver
        </p>
        <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
          {qr.resolver_url}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(qr.digital_link_url);
            toast.success("Digital Link copied");
          }}
        >
          Copy link
        </Button>
      </div>

      <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GTIN · Version</p>
        <p className="mt-0.5 break-all font-mono text-sm font-medium">
          {qr.gtin} · v{qr.version}
        </p>
        <p className="mt-1 break-words text-xs text-muted-foreground">Generated {generatedDate}</p>
        <p className="mt-1 break-words text-xs">
          <span className="text-muted-foreground">Store identity: </span>
          {qr.store_name ? (
            <span className="font-medium">
              {qr.store_name}
              {storeCode ? <span className="text-muted-foreground"> · {storeCode}</span> : null}
            </span>
          ) : (
            <span className="text-amber-600">Not assigned</span>
          )}
        </p>
      </div>

      {/* Assign / change the branch this QR belongs to — regenerating with a
          store selected stamps store_id + store_name onto the asset. */}
      {stores.length > 0 && (
        <div className="grid gap-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Store identity
          </p>
          <Select
            value={storeId ?? qr.store_id ?? "__none__"}
            onValueChange={(v) => setStoreId(v === "__none__" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Assign a branch…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">All stores (no attribution)</SelectItem>
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
          <p className="text-[11px] text-muted-foreground">
            Scans then attribute the customer's opt-in phone number to this branch.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => download(qr.png_url, `qr-${qr.gtin}.png`)}>
          <Download className="mr-2 h-4 w-4" /> PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => download(qr.svg_url, `qr-${qr.gtin}.svg`)}>
          <Download className="mr-2 h-4 w-4" /> SVG
        </Button>
        <Button variant="outline" size="sm" onClick={() => printQr(qr.png_url, productName, qr.gtin)}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
        <a
          href={dppHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" /> View Digital ID
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
    {clashDialogs}
    </>
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
