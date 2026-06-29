import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Image as ImageIcon, MoreHorizontal, Edit, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMoney } from "@/lib/format";
import { IntentBadge } from "@/components/intent/intent-badge";

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
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectChange(next);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-8">
              <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
            </TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="hidden md:table-cell">Brand</TableHead>
            <TableHead className="hidden lg:table-cell">Category</TableHead>
            <TableHead className="hidden lg:table-cell">Store</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="hidden xl:table-cell">Intent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const thumb = (r.images?.[0]?.url) ?? r.image_url ?? null;
            const onSale = r.sale_price_cents != null && r.sale_price_cents < r.price_cents;
            const stockTone =
              r.stock_qty === 0
                ? "destructive"
                : r.stock_qty <= r.low_stock_threshold
                  ? "warning"
                  : "ok";
            return (
              <TableRow key={r.id} className="group">
                <TableCell>
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggleRow(r.id)}
                    aria-label={`Select ${r.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
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
                      <p className="truncate text-xs text-muted-foreground">{r.sku}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.brand ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.category?.name ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.store?.name ?? "—"}</TableCell>
                <TableCell className="text-right text-sm">
                  {onSale ? (
                    <span className="flex items-baseline justify-end gap-2">
                      <span className="text-muted-foreground line-through">
                        {formatMoney(r.price_cents, r.currency)}
                      </span>
                      <span className="font-semibold text-success">
                        {formatMoney(r.sale_price_cents!, r.currency)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium">{formatMoney(r.price_cents, r.currency)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm">
                  <span
                    className={
                      stockTone === "destructive"
                        ? "text-destructive"
                        : stockTone === "warning"
                          ? "text-warning"
                          : "text-foreground"
                    }
                  >
                    {r.stock_qty}
                  </span>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <IntentBadge
                    score={r.intent_score ?? 50}
                    trend={(r.intent_score_trend as any) ?? "stable"}
                    confidence={r.intent_score_confidence ?? 0}
                    size="sm"
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge value={r.status} />
                </TableCell>
                <TableCell>
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

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-success/15 text-success border-success/20" },
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    archived: { label: "Archived", className: "bg-warning/15 text-warning border-warning/20" },
  };
  const v = map[value] ?? { label: value, className: "" };
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
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
          {row.status !== "archived" && (
            <DropdownMenuItem onClick={() => onArchive(row)}>
              <Archive className="mr-2 h-4 w-4" /> Archive
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
