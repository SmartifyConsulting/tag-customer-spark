import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Barcode, FileUp, Loader2, QrCode, Sparkles } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { previewProductImport, commitProductImport, type ImportRow } from "@/lib/import.functions";
import {
  bulkCompleteDigitalIdentity,
  listIncompleteDigitalIdentityIds,
} from "@/lib/products.functions";
import { assignMissingBarcodes } from "@/lib/barcode-assign.functions";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

// Batch size for both phases — small enough that the progress bar advances
// smoothly and a single request never takes too long, since commit runs
// AI category-suggestion and QR/image work per row server-side.
const IMPORT_CHUNK = 10;
const TAG_CHUNK = 5;
// A chunk that never answers used to freeze the bar forever (the rows had
// actually landed server-side). Bound every chunk and retry it once.
const CHUNK_TIMEOUT_MS = 90_000;

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timed out — retrying")), CHUNK_TIMEOUT_MS),
        ),
      ]);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function formatEta(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `about ${s}s left`;
  const m = Math.round(s / 60);
  return `about ${m} min left`;
}


export function ImportProductsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const previewFn = useServerFn(previewProductImport);
  const commitFn = useServerFn(commitProductImport);
  const assignBarcodesFn = useServerFn(assignMissingBarcodes);
  const listIncompleteFn = useServerFn(listIncompleteDigitalIdentityIds);
  const bulkCompleteFn = useServerFn(bulkCompleteDigitalIdentity);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [label, setLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"merge" | "overwrite">("merge");
  const [eta, setEta] = useState<string | null>(null);

  const preview = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return previewFn({
        data: { filename: f.name, mime: f.type || "application/octet-stream", base64 },
      });
    },
    onSuccess: (res) => {
      setRows(res.rows);
      if (!res.rows.length) toast.warning("No products detected in file");
      else toast.success(`Parsed ${res.rows.length} products — review and confirm`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to read file"),
  });

  // One continuous, aggregate progress bar for the whole operation — import
  // (chunked so progress reflects real completion, not a single opaque
  // request), then the same barcode-to-QR pipeline as "Tag Intelligence" so
  // any product that came in without a usable barcode still ends up tagged.
  const runImportAndTag = async () => {
    setProcessing(true);
    try {
      let created = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];
      let taxonomyApplied = false;
      let taxonomyName: string | null = null;
      let storesCreated = 0;
      let brandsCreated = 0;

      setProgress(2);
      // Rolling ETA from measured chunk throughput — the first chunk sets the
      // baseline, later chunks smooth it.
      const startedAt = Date.now();
      for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
        const chunk = rows.slice(i, i + IMPORT_CHUNK);
        const done = Math.min(i + chunk.length, rows.length);
        setLabel(`Importing products… ${done} / ${rows.length}`);
        const res = await withRetry(() => commitFn({ data: { rows: chunk, mode } }));
        created += res.created;
        updated += res.updated;
        failed += res.failed;
        errors.push(...res.errors);
        if (res.taxonomyProfileApplied) {
          taxonomyApplied = true;
          taxonomyName = res.taxonomyProfileName ?? null;
        }
        storesCreated += res.storesCreated ?? 0;
        brandsCreated += res.brandsCreated ?? 0;
        setProgress(2 + Math.round((done / rows.length) * 43));
        const perRow = (Date.now() - startedAt) / done;
        // Remaining import rows, plus the tagging phase that follows (which
        // historically runs at roughly the same cost per product).
        setEta(formatEta(perRow * (rows.length - done) + perRow * rows.length * 0.9));
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      if (taxonomyApplied) qc.invalidateQueries({ queryKey: ["taxonomy-active"] });
      if (storesCreated > 0) qc.invalidateQueries({ queryKey: ["stores"] });
      if (brandsCreated > 0) qc.invalidateQueries({ queryKey: ["brands"] });

      setProgress(50);
      setLabel("Assigning missing barcodes…");
      await assignBarcodesFn();
      await qc.invalidateQueries();
      setProgress(60);

      setLabel("Finding products that still need a QR code…");
      const { ids } = await listIncompleteFn();

      if (ids.length > 0) {
        let done = 0;
        for (let i = 0; i < ids.length; i += TAG_CHUNK) {
          const chunk = ids.slice(i, i + TAG_CHUNK);
          setLabel(`Generating QR codes… ${done} / ${ids.length}`);
          const chunkStart = Date.now();
          await withRetry(() => bulkCompleteFn({ data: { productIds: chunk } }));
          done += chunk.length;
          setProgress(60 + Math.round((done / ids.length) * 40));
          const perId = (Date.now() - chunkStart) / chunk.length;
          setEta(formatEta(perId * (ids.length - done)));
        }
      } else {
        setProgress(100);
      }
      await qc.invalidateQueries();

      setLabel("All done.");
      setEta(null);
      toast.success(
        `Imported: ${created} new, ${updated} updated${failed ? `, ${failed} failed` : ""}`,
      );
      if (taxonomyApplied && taxonomyName) {
        toast.success(`Detected "${taxonomyName}" taxonomy — set up automatically.`);
      }
      if (storesCreated > 0) {
        toast.success(
          `${storesCreated} store${storesCreated === 1 ? "" : "s"} added from the import — check Stores.`,
        );
      }
      if (brandsCreated > 0) {
        toast.success(`${brandsCreated} brand${brandsCreated === 1 ? "" : "s"} added, logos fetched where possible.`);
      }
      if (errors.length) console.warn("Import errors:", errors);

      await new Promise((r) => setTimeout(r, 600));
      setProcessing(false);
      setRows([]);
      setFile(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
      setEta(null);
      setProcessing(false);
    }
  };

  const reset = () => {
    setRows([]);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (processing) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import products</DialogTitle>
          <DialogDescription>
            Upload an XLSX, CSV, or PDF catalogue. AI will map columns, preserve GTINs, and generate
            GS1 Digital Link QR codes (PNG, SVG, PDF).
          </DialogDescription>
        </DialogHeader>

        {processing ? (
          <div className="grid gap-5 py-6 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Barcode className="h-5 w-5" />
              <ArrowRight className="h-4 w-4" />
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Importing your products…</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
            <Progress value={progress} className="mx-auto max-w-sm" />
          </div>
        ) : rows.length === 0 ? (
          <div className="grid gap-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center hover:bg-muted/50">
              <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
              <span className="font-medium">Choose XLSX, CSV, or PDF</span>
              <span className="mt-1 text-xs text-muted-foreground">
                Up to ~500 products per file
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setFile(f);
                  preview.mutate(f);
                }}
              />
            </label>
            {preview.isPending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <Sparkles className="h-4 w-4" /> Reading {file?.name}…
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Badge>{rows.length} products</Badge>
                <span className="text-muted-foreground">
                  from <span className="font-medium text-foreground">{file?.name}</span>
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                Choose different file
              </Button>
            </div>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "merge" | "overwrite")}
              className="grid gap-2 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <RadioGroupItem value="merge" className="mt-0.5" />
                <span>
                  <span className="font-medium">Merge</span>
                  <span className="block text-xs text-muted-foreground">
                    Update matching products, keep existing fields this file doesn't include
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <RadioGroupItem value="overwrite" className="mt-0.5" />
                <span>
                  <span className="font-medium">Overwrite</span>
                  <span className="block text-xs text-muted-foreground">
                    Replace matching products entirely with this file's data
                  </span>
                </span>
              </label>
            </RadioGroup>
            <ScrollArea className="max-h-[420px] rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>GTIN</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={`${r.sku}-${i}`}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.sku}</TableCell>
                      <TableCell className="font-mono text-xs">{r.gtin ?? "—"}</TableCell>
                      <TableCell>
                        {r.barcode_type ? (
                          <Badge variant="secondary">{r.barcode_type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {((r.price_cents ?? 0) / 100).toFixed(2)} {r.currency}
                      </TableCell>
                      <TableCell className="text-right">{r.stock_qty ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        {!processing && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {rows.length > 0 && (
              <Button onClick={runImportAndTag}>
                {`Import ${rows.length} products & generate QR codes`}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
