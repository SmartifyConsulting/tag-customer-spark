import { useMemo, useState } from "react";
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
import { ChevronDown, ChevronRight, GitMerge, Package, Plus, Tag, Trash2 } from "lucide-react";
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
import {
  browseTaxonomy,
  createAttributeValue,
  deleteAttributeValue,
  listAttributeValues,
  moveProductAttribute,
} from "@/lib/taxonomy.functions";
import { mergeTaxonomyGroups } from "@/lib/taxonomy-merge.functions";
import { cn } from "@/lib/utils";

type DragProductData = { type: "product"; productId: string; name: string; sourceValue: string };
type DropGroupData = { type: "group"; value: string; label: string };

export function AttributeAdminTab({ attributeKey, label }: { attributeKey: string; label: string }) {
  const qc = useQueryClient();
  const browseFn = useServerFn(browseTaxonomy);
  const moveFn = useServerFn(moveProductAttribute);
  const valuesFn = useServerFn(listAttributeValues);
  const createValueFn = useServerFn(createAttributeValue);
  const deleteValueFn = useServerFn(deleteAttributeValue);

  const isCustom = attributeKey.startsWith("custom:");

  const groupsQ = useQuery({
    queryKey: ["attribute-groups", attributeKey],
    queryFn: () => browseFn({ data: { dryLevels: [{ attribute_key: attributeKey, label }], path: [] } }),
  });
  const predeclaredQ = useQuery({
    queryKey: ["attribute-values", attributeKey],
    queryFn: () => valuesFn({ data: { attribute_key: attributeKey } }),
    enabled: isCustom,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["attribute-groups", attributeKey] });
    qc.invalidateQueries({ queryKey: ["attribute-values", attributeKey] });
    qc.invalidateQueries({ queryKey: ["attribute-products"] });
  };

  const [newValue, setNewValue] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragProductData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const createValue = useMutation({
    mutationFn: (label: string) => createValueFn({ data: { attribute_key: attributeKey, label } }),
    onSuccess: () => {
      invalidate();
      toast.success("Value added");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const removeValue = useMutation({
    mutationFn: (id: string) => deleteValueFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Removed");
    },
  });

  const move = useMutation({
    mutationFn: (v: { productId: string; value: string; productName: string; targetLabel: string }) =>
      moveFn({ data: { productId: v.productId, attribute_key: attributeKey, value: v.value } }),
    onSuccess: (_r, v) => {
      invalidate();
      toast.success(`Moved "${v.productName}" to "${v.targetLabel}"`);
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
    const o = e.over?.data.current as DropGroupData | undefined;
    if (!a || a.type !== "product" || !o || o.type !== "group") return;
    if (a.sourceValue === o.value) return;
    move.mutate({ productId: a.productId, value: o.value, productName: a.name, targetLabel: o.label });
  };

  // Merge browsed groups (which have real product counts) with any
  // pre-declared-but-empty custom values so they're visible as drop targets
  // before the first product is tagged.
  const groups = useMemo(() => {
    const fromBrowse = (groupsQ.data?.groups ?? []) as { value: string; label: string; count: number }[];
    if (!isCustom) return fromBrowse;
    const seen = new Set(fromBrowse.map((g) => g.value));
    const extra = (predeclaredQ.data?.values ?? [])
      .filter((v: any) => !seen.has(v.value))
      .map((v: any) => ({ value: v.value, label: v.label, count: 0, valueId: v.id }));
    return [...fromBrowse, ...extra].sort((a, b) => a.label.localeCompare(b.label));
  }, [groupsQ.data, predeclaredQ.data, isCustom]);

  const valueIdByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of predeclaredQ.data?.values ?? []) m.set((v as any).value, (v as any).id);
    return m;
  }, [predeclaredQ.data]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" /> {label} admin
        </CardTitle>
        <CardDescription>
          {isCustom
            ? `Manage "${label}" values and drag products onto a value to assign it.`
            : `Values are drawn from the catalogue's "${label}" data. Drag a product onto another value to reassign it.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <div className="text-sm">
            <span className="font-medium">{groups.length}</span>{" "}
            <span className="text-muted-foreground">value{groups.length === 1 ? "" : "s"}</span>
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)} disabled={groups.length < 2}>
              <GitMerge className="mr-1 h-3.5 w-3.5" /> Merge
            </Button>
          </div>
        </div>

        {isCustom && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newValue.trim()) return;
              createValue.mutate(newValue.trim(), { onSuccess: () => setNewValue("") });
            }}
          >
            <Input
              placeholder={`New ${label.toLowerCase()} value`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" disabled={createValue.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add value
            </Button>
          </form>
        )}

        {groupsQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={`No ${label.toLowerCase()} values yet`}
            description={isCustom ? "Add a value above to get started." : "No products carry this attribute yet."}
          />
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <ul className="divide-y rounded-xl border">
              {groups.map((g: any) => (
                <AttributeValueRow
                  key={g.value}
                  value={g.value}
                  label={g.label}
                  count={g.count}
                  attributeKey={attributeKey}
                  canDelete={isCustom && g.count === 0 && valueIdByValue.has(g.value)}
                  onDelete={() => {
                    const id = valueIdByValue.get(g.value);
                    if (id && confirm(`Remove "${g.label}"?`)) removeValue.mutate(id);
                  }}
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

      <MergeAttributeValuesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        attributeKey={attributeKey}
        label={label}
        groups={groups}
        onMerged={invalidate}
      />
    </Card>
  );
}

function AttributeValueRow({
  value,
  label,
  count,
  attributeKey,
  canDelete,
  onDelete,
}: {
  value: string;
  label: string;
  count: number;
  attributeKey: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `attrval:${value}`,
    data: { type: "group", value, label } satisfies DropGroupData,
  });

  return (
    <li className="px-3 py-2">
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
          disabled={count === 0}
        >
          {count > 0 ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
        </button>
        <span className="flex-1 truncate text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{count} products</span>
        {canDelete && (
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {open && count > 0 && (
        <div className="mt-2" style={{ marginLeft: 32 }}>
          <AttributeValueProductsPanel attributeKey={attributeKey} value={value} />
        </div>
      )}
    </li>
  );
}

function AttributeValueProductsPanel({ attributeKey, value }: { attributeKey: string; value: string }) {
  const browseFn = useServerFn(browseTaxonomy);
  const productsQ = useQuery({
    queryKey: ["attribute-products", attributeKey, value],
    queryFn: () =>
      browseFn({
        data: {
          dryLevels: [{ attribute_key: attributeKey, label: attributeKey }],
          path: [{ attribute_key: attributeKey, value }],
        },
      }),
  });

  return (
    <div className="rounded-lg border bg-muted/10 p-2">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Products with this value
      </div>
      {productsQ.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : productsQ.data?.products?.length ? (
        <ul className="divide-y rounded-md border bg-background">
          {productsQ.data.products.slice(0, 20).map((p: any) => (
            <DraggableProductRow key={p.id} product={p} sourceValue={value} />
          ))}
          {productsQ.data.products.length > 20 && (
            <li className="px-2 py-1.5 text-center text-[11px] text-muted-foreground">
              +{productsQ.data.products.length - 20} more
            </li>
          )}
        </ul>
      ) : (
        <p className="px-1 py-2 text-xs text-muted-foreground">No products.</p>
      )}
    </div>
  );
}

function DraggableProductRow({ product: p, sourceValue }: { product: any; sourceValue: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `attrprod:${p.id}`,
    data: { type: "product", productId: p.id, name: p.name, sourceValue } satisfies DragProductData,
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
        aria-label="Drag to move to another value"
      >
        <Package className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate">{p.name}</span>
      {p.stock_qty != null && <Badge variant="outline" className="text-[10px]">{p.stock_qty} qty</Badge>}
    </li>
  );
}

function MergeAttributeValuesDialog({
  open,
  onOpenChange,
  attributeKey,
  label,
  groups,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  attributeKey: string;
  label: string;
  groups: { value: string; label: string; count: number }[];
  onMerged: () => void;
}) {
  const mergeFn = useServerFn(mergeTaxonomyGroups);
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string | null>(null);

  const merge = useMutation({
    mutationFn: (args: { target_value: string; source_values: string[] }) =>
      mergeFn({ data: { attribute_key: attributeKey, ...args } }),
    onSuccess: (r: any) => {
      toast.success(`Merged, ${r.updated} product${r.updated === 1 ? "" : "s"} updated`);
      setChecked(new Set());
      setTarget(null);
      onOpenChange(false);
      onMerged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Merge failed"),
  });

  const toggle = (value: string) => {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      if (!next.has(target ?? "")) setTarget(next.values().next().value ?? null);
      return next;
    });
  };

  const items = groups.filter(
    (g) => !search.trim() || g.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const checkedCount = checked.size;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSearch("");
          setChecked(new Set());
          setTarget(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge {label.toLowerCase()} values</DialogTitle>
          <DialogDescription>
            Select values to merge and choose which one survives — every product carrying a source value is
            re-pointed to the target.
          </DialogDescription>
        </DialogHeader>

        <Input placeholder={`Search ${label.toLowerCase()} values…`} value={search} onChange={(e) => setSearch(e.target.value)} />

        <ScrollArea className="max-h-[45vh] pr-3">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No values match.</p>
          ) : (
            <RadioGroup value={target ?? undefined} onValueChange={setTarget}>
              <ul className="space-y-1">
                {items.map((g) => (
                  <li key={g.value} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/40">
                    <Checkbox checked={checked.has(g.value)} onCheckedChange={() => toggle(g.value)} />
                    <RadioGroupItem value={g.value} disabled={!checked.has(g.value)} />
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <Badge variant="secondary" className="text-[10px]">{g.count} products</Badge>
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
                target_value: target!,
                source_values: Array.from(checked).filter((v) => v !== target),
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
