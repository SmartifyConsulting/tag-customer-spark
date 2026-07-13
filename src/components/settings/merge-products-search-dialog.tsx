import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GitMerge, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listProducts, mergeProducts } from "@/lib/products.functions";

export function MergeProductsSearchDialog({
  open,
  onOpenChange,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMerged: () => void;
}) {
  const listFn = useServerFn(listProducts);
  const mergeFn = useServerFn(mergeProducts);

  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string | null>(null);
  const [checkedDetail, setCheckedDetail] = useState<Map<string, { name: string; sku: string | null; stock_qty: number | null }>>(
    new Map(),
  );

  const listQ = useQuery({
    queryKey: ["products-for-merge", search],
    queryFn: () => listFn({ data: { search: search.trim() || undefined, pageSize: 30, status: "all" } }),
    enabled: open,
  });

  const merge = useMutation({
    mutationFn: (args: { targetId: string; sourceIds: string[] }) => mergeFn({ data: args }),
    onSuccess: (r: any) => {
      toast.success(`Merged ${r.merged ?? 1} product${(r.merged ?? 1) === 1 ? "" : "s"}`);
      reset();
      onOpenChange(false);
      onMerged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Merge failed"),
  });

  const reset = () => {
    setSearch("");
    setChecked(new Set());
    setTarget(null);
    setCheckedDetail(new Map());
  };

  const toggle = (p: { id: string; name: string; sku: string | null; stock_qty: number | null }) => {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      if (!next.has(target ?? "")) setTarget(next.values().next().value ?? null);
      return next;
    });
    setCheckedDetail((cur) => {
      const next = new Map(cur);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, { name: p.name, sku: p.sku, stock_qty: p.stock_qty });
      return next;
    });
  };

  const uncheckById = (id: string) => {
    setChecked((cur) => {
      const next = new Set(cur);
      next.delete(id);
      if (target === id) setTarget(next.values().next().value ?? null);
      return next;
    });
    setCheckedDetail((cur) => {
      const next = new Map(cur);
      next.delete(id);
      return next;
    });
  };

  const rows = listQ.data?.rows ?? [];
  const checkedCount = checked.size;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge products</DialogTitle>
          <DialogDescription>
            Search to narrow the list, select any products to merge, and pick which one survives — its stock
            absorbs the others, and the rest are archived (scan history is kept).
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {checkedCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {Array.from(checkedDetail.entries()).map(([id, d]) => (
              <Badge key={id} variant={id === target ? "default" : "secondary"} className="gap-1 text-[10px]">
                {d.name}
                <button onClick={() => uncheckById(id)} aria-label={`Remove ${d.name}`} className="hover:opacity-70">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <ScrollArea className="max-h-[45vh] pr-3">
          {listQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No products match.</p>
          ) : (
            <RadioGroup value={target ?? undefined} onValueChange={setTarget}>
              <ul className="space-y-1">
                {rows.map((p: any) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/40">
                    <Checkbox checked={checked.has(p.id)} onCheckedChange={() => toggle(p)} />
                    <RadioGroupItem value={p.id} disabled={!checked.has(p.id)} />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {p.sku && <span className="text-muted-foreground"> ({p.sku})</span>}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{p.stock_qty ?? 0} qty</Badge>
                  </li>
                ))}
              </ul>
            </RadioGroup>
          )}
        </ScrollArea>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-[11px] text-muted-foreground">☐ select, ◯ pick survivor</span>
          <Button
            disabled={checkedCount < 2 || !target || merge.isPending}
            onClick={() =>
              merge.mutate({
                targetId: target!,
                sourceIds: Array.from(checked).filter((id) => id !== target),
              })
            }
          >
            <GitMerge className="mr-1 h-3.5 w-3.5" /> Merge {checkedCount || ""} into selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
