import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  previewProductImport,
  commitProductImport,
  type ImportRow,
} from "@/lib/import.functions";

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

export function ImportProductsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const previewFn = useServerFn(previewProductImport);
  const commitFn = useServerFn(commitProductImport);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [file, setFile] = useState<File | null>(null);

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

  const commit = useMutation({
    mutationFn: () => commitFn({ data: { rows } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `Imported: ${res.created} new, ${res.updated} updated${res.failed ? `, ${res.failed} failed` : ""}`,
      );
      if (res.errors?.length) console.warn("Import errors:", res.errors);
      setRows([]);
      setFile(null);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  const reset = () => {
    setRows([]);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import products</DialogTitle>
          <DialogDescription>
            Upload an XLSX, CSV, or PDF catalogue. AI will map columns, preserve GTINs,
            and generate GS1 Digital Link QR codes (PNG, SVG, PDF).
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
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
                        {(r.price_cents / 100).toFixed(2)} {r.currency}
                      </TableCell>
                      <TableCell className="text-right">{r.stock_qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {rows.length > 0 && (
            <Button onClick={() => commit.mutate()} disabled={commit.isPending}>
              {commit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
                </>
              ) : (
                `Import ${rows.length} products & generate QR codes`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
