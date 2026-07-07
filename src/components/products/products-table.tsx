import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  ArchiveRestore,
  Image as ImageIcon,
  MoreHorizontal,
  Edit,
  Archive,
  QrCode,
  Trash2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import { formatMoney } from "@/lib/format";
import { regenerateProductQr } from "@/lib/qr.functions";
import { updateProduct } from "@/lib/products.functions";
import { NotificationCountPills } from "@/components/products/notification-count-pills";
import type { ProductNotificationCounts } from "@/lib/dashboard.functions";

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  status: string;
  price_cents: number;
  sale_price_cents: number | null;
  currency: string;
  stock_qty: number;
  low_stock_threshold: number;
  size: string | null;
  color: string | null;
  images: { url: string }[] | null;
  image_url: string | null;
  category: { name: string } | null;
  store: { name: string } | null;
  intent_score?: number | null;
  intent_score_trend?: "rising" | "falling" | "stable" | null;
  intent_score_confidence?: number | null;
};

export function ProductsTable({
  rows,
  selected,
  onSelectChange,
  onEdit,
  onArchive,
  onDelete,
  canManage,
}: {
  rows: ProductRow[];
  selected: Set<string>;
  onSelectChange: (s: Set<string>) => void;
  onEdit: (r: ProductRow) => void;
  onArchive: (r: ProductRow) => void;
  onDelete: (r: ProductRow) => void;
  canManage: boolean;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allChecked) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    onSelectChange(next);
  }
  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectChange(next);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-transparent hover:bg-transparent">
            <TableHead className="w-8 pl-6">
              <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary">
              Product
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Price
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Qty
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Size
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Colour
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              QR
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Interest
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const thumb = r.images?.[0]?.url ?? r.image_url ?? null;
            const onSale = r.sale_price_cents != null && r.sale_price_cents < r.price_cents;
            const qty = r.stock_qty ?? 0;
            const threshold = r.low_stock_threshold ?? 0;
            const qtyClass =
              qty <= 0
                ? "text-rose-600"
                : qty <= threshold
                  ? "text-amber-600"
                  : "text-foreground";
            return (
              <TableRow key={r.id} className="group border-b border-border/60 last:border-0">
                <TableCell className="pl-6">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggleRow(r.id)}
                    aria-label={`Select ${r.name}`}
                  />
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to="/products/$productId"
                        params={{ productId: r.id }}
                        className="block truncate font-medium text-foreground hover:underline"
                      >
                        {r.name}
                      </Link>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {onSale ? (
                    <span className="flex items-baseline gap-2">
                      <span className="text-muted-foreground line-through">
                        {formatMoney(r.price_cents, r.currency)}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatMoney(r.sale_price_cents!, r.currency)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium text-foreground">
                      {formatMoney(r.price_cents, r.currency)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-sm font-semibold tabular-nums ${qtyClass}`}>
                    {qty}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.size ? <span className="text-foreground">{r.size}</span> : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.color ? <span className="text-foreground">{r.color}</span> : "—"}
                </TableCell>
                <TableCell>
                  <QrDownloadButton productId={r.id} name={r.name} />
                </TableCell>
                <TableCell>
                  <InterestRing score={r.intent_score ?? 0} />
                </TableCell>
                <TableCell className="pr-4">
                  {canManage && (
                    <RowActions row={r} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}



async function downloadQr(productId: string, name: string) {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/public/s/${productId}`;
    const dataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      errorCorrectionLevel: "M",
      width: 800,
      color: { dark: "#031C4D", light: "#ffffff" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    a.click();
  } catch (e: any) {
    toast.error(e?.message ?? "Download failed");
  }
}

function QrDownloadButton({ productId, name }: { productId: string; name: string }) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      onClick={() => downloadQr(productId, name)}
      aria-label="Download QR"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}

function InterestRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative h-11 w-11">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle cx="22" cy="22" r={r} strokeWidth="3.5" className="fill-none stroke-muted" />
        <circle
          cx="22"
          cy="22"
          r={r}
          strokeWidth="3.5"
          strokeLinecap="round"
          className="fill-none stroke-[color:var(--mint)] transition-[stroke-dashoffset]"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums text-[color:var(--mint)]">
        {clamped}
      </span>
    </div>
  );
}


function RowActions({
  row,
  onEdit,
  onArchive,
  onDelete,
}: {
  row: ProductRow;
  onEdit: (r: ProductRow) => void;
  onArchive: (r: ProductRow) => void;
  onDelete: (r: ProductRow) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const regenFn = useServerFn(regenerateProductQr);
  const updateFn = useServerFn(updateProduct);

  const generate = useMutation({
    mutationFn: () => regenFn({ data: { productId: row.id, template: "classic" } }),
    onSuccess: () => toast.success("QR code generated"),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const unarchive = useMutation({
    mutationFn: () => updateFn({ data: { id: row.id, patch: { status: "active" } as any } }),
    onSuccess: () => toast.success("Unarchived"),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <Edit className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => generate.mutate()}>
            <QrCode className="mr-2 h-4 w-4" /> Generate QR
          </DropdownMenuItem>
          {row.status !== "archived" ? (
            <DropdownMenuItem onClick={() => onArchive(row)}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => unarchive.mutate()}>
              <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product and any QR tags and scan history attached to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(row)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
