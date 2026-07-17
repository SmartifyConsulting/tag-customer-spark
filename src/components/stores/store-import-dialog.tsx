import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, Store as StoreIcon } from "lucide-react";
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
import {
  previewStoreImport,
  commitStoreImport,
  type StoreImportRow,
} from "@/lib/stores-import.functions";

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

export function StoreImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const previewFn = useServerFn(previewStoreImport);
  const commitFn = useServerFn(commitStoreImport);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<StoreImportRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [committing, setCommitting] = useState(false);

  const preview = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return previewFn({
        data: { filename: f.name, mime: f.type || "application/octet-stream", base64 },
      });
    },
    onSuccess: (res) => {
      setRows(res.rows);
      if (!res.rows.length) toast.warning("No stores/branches detected in file");
      else toast.success(`Parsed ${res.rows.length} stores — review and confirm`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to read file"),
  });

  const reset = () => {
    setRows([]);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const res = await commitFn({ data: { rows } });
      qc.invalidateQueries({ queryKey: ["stores"] });
      toast.success(
        `Stores: ${res.created} added, ${res.updated} updated${res.errors.length ? `, ${res.errors.length} issues` : ""}`,
      );
      if (res.errors.length) console.warn("Store import errors:", res.errors);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (committing) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload stores</DialogTitle>
          <DialogDescription>
            Upload an XLSX, CSV, or PDF branch list from your ERP or POS (plant/site/warehouse
            export). AI will map the columns — existing stores are matched by name and updated,
            new ones are created.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="grid gap-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center hover:bg-muted/50">
              <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
              <span className="font-medium">Choose XLSX, CSV, or PDF</span>
              <span className="mt-1 text-xs text-muted-foreground">Up to ~500 stores per file</span>
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
                <Badge>
                  <StoreIcon className="mr-1 h-3 w-3" /> {rows.length} stores
                </Badge>
                <span className="text-muted-foreground">
                  from <span className="font-medium text-foreground">{file?.name}</span>
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} disabled={committing}>
                Choose different file
              </Button>
            </div>
            <ScrollArea className="max-h-[420px] rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.city || "—"}</TableCell>
                      <TableCell>{r.province || "—"}</TableCell>
                      <TableCell>{r.country || "—"}</TableCell>
                      <TableCell>{r.manager_name || "—"}</TableCell>
                      <TableCell>{r.contact_phone || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={committing}>
                Cancel
              </Button>
              <Button onClick={handleCommit} disabled={committing}>
                {committing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add {rows.length} store{rows.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
