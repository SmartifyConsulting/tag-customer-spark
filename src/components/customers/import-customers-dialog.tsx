import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
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
  previewCustomerImport,
  commitCustomerImport,
  type CustomerImportRow,
} from "@/lib/customer-import.functions";
import { getWorkspaceSettings } from "@/lib/settings.functions";

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

export function ImportCustomersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const previewFn = useServerFn(previewCustomerImport);
  const commitFn = useServerFn(commitCustomerImport);
  const settingsFn = useServerFn(getWorkspaceSettings);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CustomerImportRow[]>([]);
  const [file, setFile] = useState<File | null>(null);

  // Ties the import prompt back to the POS/ERP the retailer already told us
  // about in TAG Setup, so this reads as "pull from your connected system"
  // rather than a generic file uploader.
  const settings = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: () => settingsFn(),
    enabled: open,
    staleTime: 60_000,
  });
  const posSystem = (settings.data?.retailer as any)?.pos_system as string | null | undefined;

  const preview = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return previewFn({
        data: { filename: f.name, mime: f.type || "application/octet-stream", base64 },
      });
    },
    onSuccess: (res) => {
      setRows(res.rows);
      if (!res.rows.length) {
        toast.warning("No customers with a usable name and phone number were found in that file.");
      } else {
        toast.success(`Parsed ${res.rows.length} customers — review and confirm`);
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to read file"),
  });

  const commit = useMutation({
    mutationFn: () => commitFn({ data: { rows } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(
        `Imported: ${res.created} new, ${res.updated} updated${res.failed ? `, ${res.failed} failed` : ""}`,
      );
      if (res.errors?.length) console.warn("Customer import errors:", res.errors);
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import customers</DialogTitle>
          <DialogDescription>
            {posSystem
              ? `Export your customer list from ${posSystem} (or any CRM/POS) as XLSX or CSV and upload it here — AI will map the columns automatically.`
              : "Upload your customer list as an XLSX or CSV export from your POS/ERP or CRM — AI will map the columns automatically."}
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="grid gap-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center hover:bg-muted/50">
              <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
              <span className="font-medium">Choose XLSX or CSV</span>
              <span className="mt-1 text-xs text-muted-foreground">
                Name, phone number, and email columns
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
                <Loader2 className="h-4 w-4 animate-spin" /> Reading {file?.name}…
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Badge>{rows.length} customers</Badge>
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
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={`${r.whatsapp_e164}-${i}`}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.whatsapp_e164}</TableCell>
                      <TableCell>{r.email || "—"}</TableCell>
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
                `Import ${rows.length} customers`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
