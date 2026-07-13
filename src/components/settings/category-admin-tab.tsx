import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  FolderTree,
  Sparkles,
  GitMerge,
  GripVertical,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { EmptyState } from "@/components/empty-state";
import { MergeProductsSearchDialog } from "@/components/settings/merge-products-search-dialog";
import {
  listCategoriesWithCounts,
  createCategory,
  renameCategory,
  deleteCategory,
  bulkAutoCategorise,
  mergeCategories,
  moveProductCategory,
} from "@/lib/categories.functions";
import { listProducts, findDuplicateProducts, mergeProducts } from "@/lib/products.functions";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; parent_id: string | null; status: string };

type DragProductData = { type: "product"; productId: string; name: string; sourceCategoryId: string };
type DropCategoryData = { type: "category"; categoryId: string; categoryName: string };

export function CategoryAdminTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["categories", "with-counts"], queryFn: () => listCategoriesWithCounts() });
  const createFn = useServerFn(createCategory);
  const renameFn = useServerFn(renameCategory);
  const deleteFn = useServerFn(deleteCategory);
  const bulkFn = useServerFn(bulkAutoCategorise);
  const moveFn = useServerFn(moveProductCategory);

  const [newParent, setNewParent] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [productMergeOpen, setProductMergeOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragProductData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["category-products"] });
    qc.invalidateQueries({ queryKey: ["category-dup-products"] });
  };

  const bulk = useMutation({
    mutationFn: () => bulkFn({ data: { onlyUncategorised: true, limit: 100 } }),
    onSuccess: (r: any) => {
      invalidate();
      if (r?.assigned) toast.success(`Auto-categorised ${r.assigned}/${r.total} products`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Auto-categorise failed"),
  });

  // Auto-run once per session when uncategorised products exist.
  const autoRan = useRef(false);
  const uncategorised = q.data?.uncategorisedCount ?? 0;
  useEffect(() => {
    if (autoRan.current) return;
    if (uncategorised > 0 && !bulk.isPending) {
      autoRan.current = true;
      bulk.mutate();
    }
  }, [uncategorised, bulk]);

  const create = useMutation({
    mutationFn: (v: { name: string; parent_id: string | null }) => createFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Category added"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) => renameFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Renamed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const move = useMutation({
    mutationFn: (v: { productId: string; categoryId: string; productName: string; targetName: string }) =>
      moveFn({ data: { productId: v.productId, categoryId: v.categoryId } }),
    onSuccess: (_r, v) => {
      invalidate();
      toast.success(`Moved "${v.productName}" to "${v.targetName}"`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't move product"),
  });

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragProductData | undefined;
    if (data?.type === "product") setActiveDrag(data);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const a = e.active.data.current as DragProductData | undefined;
    const o = e.over?.data.current as DropCategoryData | undefined;
    if (!a || a.type !== "product" || !o || o.type !== "category") return;
    if (a.sourceCategoryId === o.categoryId) return;
    move.mutate({ productId: a.productId, categoryId: o.categoryId, productName: a.name, targetName: o.categoryName });
  };

  const { roots, childrenOf } = useMemo(() => {
    const rows = (q.data?.rows ?? []) as Row[];
    const roots = rows.filter((r) => !r.parent_id);
    const childrenOf = new Map<string, Row[]>();
    for (const r of rows) {
      if (r.parent_id) {
        const arr = childrenOf.get(r.parent_id) ?? [];
        arr.push(r);
        childrenOf.set(r.parent_id, arr);
      }
    }
    return { roots, childrenOf };
  }, [q.data]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FolderTree className="h-5 w-5" /> Category admin</CardTitle>
        <CardDescription>
          Manage product categories and sub-categories at any depth (e.g. Men → Shirts → Formal). Expand a category
          and drag a product onto another category to move it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <div className="text-sm">
            <span className="font-medium">{q.data?.uncategorisedCount ?? 0}</span>{" "}
            <span className="text-muted-foreground">uncategorised</span>
            {q.data?.suggestedCount ? (
              <>
                <span className="mx-2 text-muted-foreground">·</span>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" /> {q.data.suggestedCount} AI suggestions
                </Badge>
              </>
            ) : null}
            {bulk.isPending && (
              <>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Auto-categorising…
                </span>
              </>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setProductMergeOpen(true)}>
              <GitMerge className="mr-1 h-3.5 w-3.5" /> Merge products
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMergeDialogOpen(true)}>
              <GitMerge className="mr-1 h-3.5 w-3.5" /> Merge categories
            </Button>
          </div>
        </div>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newParent.trim()) return;
            create.mutate(
              { name: newParent.trim(), parent_id: null },
              { onSuccess: () => setNewParent("") },
            );
          }}
        >
          <Input
            placeholder="New top-level category name"
            value={newParent}
            onChange={(e) => setNewParent(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={create.isPending}><Plus className="mr-1 h-4 w-4" /> Add category</Button>
        </form>

        {q.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : roots.length === 0 ? (
          <EmptyState icon={FolderTree} title="No categories yet" description="Add a top-level category to get started." />
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <ul className="divide-y rounded-xl border">
              {roots.map((r) => (
                <CategoryNode
                  key={r.id}
                  row={r}
                  depth={0}
                  childrenOf={childrenOf}
                  counts={q.data?.counts ?? {}}
                  onRename={(id, name) => rename.mutate({ id, name })}
                  onDelete={(id, name) => {
                    if (confirm(`Delete "${name}" and all sub-categories?`)) remove.mutate(id);
                  }}
                  onAddSub={(parentId, name) => create.mutate({ name, parent_id: parentId })}
                />
              ))}
            </ul>
            <DragOverlay>
              {activeDrag && (
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs shadow-lg">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  {activeDrag.name}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>

      <MergeCategoriesDialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen} onMerged={invalidate} />
      <MergeProductsSearchDialog open={productMergeOpen} onOpenChange={setProductMergeOpen} onMerged={invalidate} />
    </Card>
  );
}

function CategoryNode({
  row,
  depth,
  childrenOf,
  counts,
  onRename,
  onDelete,
  onAddSub,
}: {
  row: Row;
  depth: number;
  childrenOf: Map<string, Row[]>;
  counts: Record<string, number>;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onAddSub: (parentId: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(row.name);
  const [subOpen, setSubOpen] = useState(false);
  const [subName, setSubName] = useState("");

  const kids = childrenOf.get(row.id) ?? [];
  const count = counts[row.id] ?? 0;

  const { setNodeRef, isOver } = useDroppable({
    id: `cat:${row.id}`,
    data: { type: "category", categoryId: row.id, categoryName: row.name } satisfies DropCategoryData,
  });

  return (
    <li className="px-3 py-2" style={{ marginLeft: depth > 0 ? 24 : 0 }}>
      <div
        ref={setNodeRef}
        className={cn(
          "flex items-center gap-2 rounded-lg transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/40",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded hover:bg-muted"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {editing ? (
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(row.id, nameDraft);
                setEditing(false);
              }
            }}
            className="h-8 max-w-xs"
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium">{row.name}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {count} products{kids.length ? ` · ${kids.length} sub` : ""}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setSubOpen((v) => !v)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Sub
        </Button>
        {editing ? (
          <Button size="sm" onClick={() => { onRename(row.id, nameDraft); setEditing(false); }}>Save</Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setNameDraft(row.name); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive"
          onClick={() => onDelete(row.id, row.name)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {subOpen && (
        <form
          className="mt-2 flex gap-2"
          style={{ marginLeft: 32 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!subName.trim()) return;
            onAddSub(row.id, subName.trim());
            setSubName("");
            setSubOpen(false);
            setOpen(true);
          }}
        >
          <Input
            placeholder="New sub-category"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            className="h-8 max-w-xs"
            autoFocus
          />
          <Button size="sm" type="submit">Add</Button>
        </form>
      )}

      {open && (
        <div className="mt-2 space-y-3" style={{ marginLeft: 32 }}>
          <CategoryProductsPanel categoryId={row.id} categoryName={row.name} count={count} />

          {kids.length > 0 && (
            <ul className="space-y-1 rounded-lg border">
              {kids.map((c) => (
                <CategoryNode
                  key={c.id}
                  row={c}
                  depth={depth + 1}
                  childrenOf={childrenOf}
                  counts={counts}
                  onRename={onRename}
                  onDelete={onDelete}
                  onAddSub={onAddSub}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function CategoryProductsPanel({ categoryId, categoryName, count }: { categoryId: string; categoryName: string; count: number }) {
  const listFn = useServerFn(listProducts);
  const dupFn = useServerFn(findDuplicateProducts);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const productsQ = useQuery({
    queryKey: ["category-products", categoryId],
    queryFn: () => listFn({ data: { category_id: categoryId, pageSize: 20, status: "all" } }),
  });
  const dupQ = useQuery({
    queryKey: ["category-dup-products", categoryId],
    queryFn: () => dupFn({ data: { categoryId } }),
  });

  const groupCount = dupQ.data?.groups?.length ?? 0;

  return (
    <div className="rounded-lg border bg-muted/10 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Products in this category
        </span>
        {groupCount > 0 && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setMergeDialogOpen(true)}>
            <GitMerge className="h-3 w-3" /> {groupCount} possible duplicate{groupCount === 1 ? "" : "s"}
          </Button>
        )}
      </div>
      {productsQ.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : productsQ.data?.rows?.length ? (
        <ul className="divide-y rounded-md border bg-background">
          {productsQ.data.rows.map((p: any) => (
            <DraggableProductRow key={p.id} product={p} sourceCategoryId={categoryId} />
          ))}
          {count > (productsQ.data?.rows?.length ?? 0) && (
            <li className="px-2 py-1.5 text-center text-[11px] text-muted-foreground">
              +{count - productsQ.data.rows.length} more
            </li>
          )}
        </ul>
      ) : (
        <p className="px-1 py-2 text-xs text-muted-foreground">No products in this category.</p>
      )}

      <MergeProductsDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        groups={dupQ.data?.groups ?? []}
        contextLabel={categoryName}
        onMerged={() => {
          productsQ.refetch();
          dupQ.refetch();
        }}
      />
    </div>
  );
}

function DraggableProductRow({ product: p, sourceCategoryId }: { product: any; sourceCategoryId: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `prod:${p.id}`,
    data: { type: "product", productId: p.id, name: p.name, sourceCategoryId } satisfies DragProductData,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 px-2 py-1.5 text-xs bg-background", isDragging && "opacity-40")}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to move to another category"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded bg-muted">
        {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-3 w-3 text-muted-foreground" />}
      </div>
      <span className="min-w-0 flex-1 truncate">{p.name}</span>
      {p.sku && <span className="text-muted-foreground">{p.sku}</span>}
      <Badge variant="outline" className="text-[10px]">{p.stock_qty ?? 0} qty</Badge>
    </li>
  );
}

function MergeCategoriesDialog({
  open,
  onOpenChange,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMerged: () => void;
}) {
  const listFn = useServerFn(listCategoriesWithCounts);
  const mergeFn = useServerFn(mergeCategories);
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["categories-flat-for-merge"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setChecked(new Set());
      setTarget(null);
    }
  }, [open]);

  const merge = useMutation({
    mutationFn: (args: { targetId: string; sourceIds: string[] }) => mergeFn({ data: args }),
    onSuccess: (r: any) => {
      toast.success(`Merged ${r.merged} categor${r.merged === 1 ? "y" : "ies"}`);
      qc.invalidateQueries({ queryKey: ["categories-flat-for-merge"] });
      setChecked(new Set());
      setTarget(null);
      onMerged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Merge failed"),
  });

  const rows = (listQ.data?.rows ?? []) as Row[];
  const counts = listQ.data?.counts ?? {};
  const nameById = new Map(rows.map((r) => [r.id, r.name]));

  const items = rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      parentName: r.parent_id ? nameById.get(r.parent_id) ?? null : null,
      count: counts[r.id] ?? 0,
    }))
    .filter((r) => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (id: string) => {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!next.has(target ?? "")) setTarget(next.values().next().value ?? null);
      return next;
    });
  };

  const checkedCount = checked.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge categories</DialogTitle>
          <DialogDescription>
            Select any categories to merge and choose which one survives — nothing merges automatically.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ScrollArea className="max-h-[45vh] pr-3">
          {listQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No categories match.</p>
          ) : (
            <RadioGroup value={target ?? undefined} onValueChange={setTarget}>
              <ul className="space-y-1">
                {items.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/40">
                    <Checkbox checked={checked.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                    <RadioGroupItem value={m.id} disabled={!checked.has(m.id)} />
                    <span className="min-w-0 flex-1 truncate">
                      {m.name}
                      {m.parentName && <span className="text-muted-foreground"> · in {m.parentName}</span>}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{m.count} products</Badge>
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

function MergeProductsDialog({
  open,
  onOpenChange,
  groups,
  contextLabel,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: { gtin: string; products: { id: string; name: string; sku: string | null; stock_qty: number | null }[] }[];
  contextLabel: string;
  onMerged: () => void;
}) {
  const mergeFn = useServerFn(mergeProducts);
  const [selections, setSelections] = useState<Record<number, { checked: Set<string>; target: string | null }>>({});

  useEffect(() => {
    const init: Record<number, { checked: Set<string>; target: string | null }> = {};
    groups.forEach((g, idx) => {
      init[idx] = { checked: new Set(g.products.map((p) => p.id)), target: g.products[0]?.id ?? null };
    });
    setSelections(init);
  }, [groups]);

  const merge = useMutation({
    mutationFn: (args: { targetId: string; sourceIds: string[] }) => mergeFn({ data: args }),
    onSuccess: (r: any) => {
      toast.success(`Merged ${r.merged} duplicate product${r.merged === 1 ? "" : "s"}`);
      onMerged();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Merge failed"),
  });

  const toggleMember = (idx: number, id: string) => {
    setSelections((cur) => {
      const sel = cur[idx];
      if (!sel) return cur;
      const checked = new Set(sel.checked);
      if (checked.has(id)) checked.delete(id);
      else checked.add(id);
      let target = sel.target;
      if (!checked.has(target ?? "")) target = checked.values().next().value ?? null;
      return { ...cur, [idx]: { checked, target } };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge duplicate products in "{contextLabel}"</DialogTitle>
          <DialogDescription>
            These products share the same barcode/GTIN. Pick which ones to merge and which one survives — its stock
            will absorb the others, and the rest are archived (not deleted, so scan history is kept).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[45vh] pr-3">
          <div className="space-y-4">
            {groups.map((g, idx) => {
              const sel = selections[idx];
              if (!sel) return null;
              const checkedCount = sel.checked.size;
              return (
                <div key={g.gtin} className="rounded-xl border p-3">
                  <div className="mb-2 text-[11px] text-muted-foreground">GTIN {g.gtin}</div>
                  <RadioGroup
                    value={sel.target ?? undefined}
                    onValueChange={(v) => setSelections((cur) => ({ ...cur, [idx]: { ...cur[idx], target: v } }))}
                  >
                    <ul className="space-y-1.5">
                      {g.products.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={sel.checked.has(p.id)} onCheckedChange={() => toggleMember(idx, p.id)} />
                          <RadioGroupItem value={p.id} disabled={!sel.checked.has(p.id)} />
                          <span className="min-w-0 flex-1 truncate">
                            {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">{p.stock_qty ?? 0} qty</Badge>
                        </li>
                      ))}
                    </ul>
                  </RadioGroup>
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      disabled={checkedCount < 2 || !sel.target || merge.isPending}
                      onClick={() =>
                        merge.mutate({
                          targetId: sel.target!,
                          sourceIds: Array.from(sel.checked).filter((id) => id !== sel.target),
                        })
                      }
                    >
                      <GitMerge className="mr-1 h-3.5 w-3.5" /> Merge into selected
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
