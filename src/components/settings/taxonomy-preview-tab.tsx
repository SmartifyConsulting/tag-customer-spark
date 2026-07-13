import { useEffect, useMemo, useState } from "react";
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
import { ChevronDown, ChevronRight, Eye, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { browseTaxonomy, getActiveProfile, moveProductAttribute } from "@/lib/taxonomy.functions";
import { moveProductCategory } from "@/lib/categories.functions";
import { cn } from "@/lib/utils";

// Levels resolved via the category tree (department/category/sub-category)
// are reassigned through `moveProductCategory`, since the group's `value` is
// already the target category row id. Derived/leaf attributes can't be
// reassigned by dragging onto a sibling group.
const CATEGORY_DEPTH_KEYS = new Set(["department", "category", "subcategory"]);
const NOT_REASSIGNABLE = new Set(["gender", "status", "price_band", "on_promotion", "product"]);

function isReassignable(attributeKey: string) {
  return !NOT_REASSIGNABLE.has(attributeKey);
}

type DragProductData = { type: "product"; productId: string; name: string };
type DropGroupData = { type: "group"; value: string; label: string };

export function TaxonomyPreviewTab() {
  const qc = useQueryClient();
  const activeFn = useServerFn(getActiveProfile);
  const browseFn = useServerFn(browseTaxonomy);
  const moveAttrFn = useServerFn(moveProductAttribute);
  const moveCatFn = useServerFn(moveProductCategory);

  const activeQ = useQuery({ queryKey: ["taxonomy-active"], queryFn: () => activeFn() });
  const levels = useMemo(
    () => (activeQ.data?.levels ?? []).map((l: any) => ({ attribute_key: l.attribute_key, label: l.label })),
    [activeQ.data],
  );

  const [path, setPath] = useState<{ attribute_key: string; value: string; label: string }[]>([]);
  const [activeDrag, setActiveDrag] = useState<DragProductData | null>(null);

  useEffect(() => {
    setPath([]);
  }, [levels.map((l) => l.attribute_key).join("|")]);

  const key = useMemo(
    () => JSON.stringify({ levels, path: path.map((p) => ({ a: p.attribute_key, v: p.value })) }),
    [levels, path],
  );

  const q = useQuery({
    queryKey: ["taxonomy-preview-tab", key],
    queryFn: () =>
      browseFn({
        data: { dryLevels: levels, path: path.map((p) => ({ attribute_key: p.attribute_key, value: p.value })) },
      }),
    enabled: levels.length > 0,
  });

  const currentLevel = levels[path.length];
  const reassignable = currentLevel ? isReassignable(currentLevel.attribute_key) : false;
  // Drag-and-drop between sibling groups is only meaningful (and only shows
  // draggable products) when the *next* level down is the product leaf —
  // otherwise expanding a group would reveal another layer of sub-groups,
  // not individual products.
  const nextIsLeaf =
    !!currentLevel && (path.length + 1 >= levels.length || levels[path.length + 1]?.attribute_key === "product");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["taxonomy-preview-tab"] });

  const move = useMutation({
    mutationFn: async (v: { productId: string; value: string; productName: string; targetLabel: string; attribute_key: string }) => {
      if (CATEGORY_DEPTH_KEYS.has(v.attribute_key)) {
        return moveCatFn({ data: { productId: v.productId, categoryId: v.value } });
      }
      return moveAttrFn({ data: { productId: v.productId, attribute_key: v.attribute_key, value: v.value } });
    },
    onSuccess: (_r, v) => {
      invalidate();
      toast.success(`Moved "${v.productName}" to "${v.targetLabel}"`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't move product"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragProductData | undefined;
    if (data?.type === "product") setActiveDrag(data);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    if (!currentLevel) return;
    const a = e.active.data.current as DragProductData | undefined;
    const o = e.over?.data.current as DropGroupData | undefined;
    if (!a || a.type !== "product" || !o || o.type !== "group") return;
    move.mutate({
      productId: a.productId,
      value: o.value,
      productName: a.name,
      targetLabel: o.label,
      attribute_key: currentLevel.attribute_key,
    });
  };

  if (activeQ.isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!levels.length) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Preview</CardTitle>
          <CardDescription>Publish a taxonomy profile to see the live browser here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Preview</CardTitle>
        <CardDescription>
          Browse the catalogue exactly as customers will see it. Expand a group and drag a product onto another
          group to reassign it — no need to leave this page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
            <button onClick={() => setPath([])} className="rounded px-2 py-1 hover:bg-accent">All</button>
            {path.map((p, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button onClick={() => setPath((cur) => cur.slice(0, i + 1))} className="rounded px-2 py-1 hover:bg-accent">
                  {p.label}
                </button>
              </span>
            ))}
          </div>

          {currentLevel && (
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Grouping by: {currentLevel.label}
              {reassignable && nextIsLeaf && " · expand a group and drag a product onto another to move it"}
            </div>
          )}

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {q.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : q.data?.products && q.data.products.length > 0 ? (
              <ul className="divide-y rounded-lg border bg-background">
                {q.data.products.slice(0, 40).map((p: any) => (
                  <PreviewProductRow key={p.id} product={p} draggable={false} />
                ))}
              </ul>
            ) : q.data?.groups && q.data.groups.length > 0 ? (
              nextIsLeaf && reassignable ? (
                <ul className="divide-y rounded-xl border bg-background">
                  {q.data.groups.map((g: any) => (
                    <PreviewGroupRow
                      key={g.value}
                      value={g.value}
                      label={g.label}
                      count={g.count}
                      levels={levels}
                      path={path}
                      currentLevel={currentLevel!}
                    />
                  ))}
                </ul>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {q.data.groups.map((g: any) => (
                    <PreviewGroupCard
                      key={g.value}
                      label={g.label}
                      count={g.count}
                      onOpen={() =>
                        setPath((cur) => [...cur, { attribute_key: currentLevel!.attribute_key, value: g.value, label: g.label }])
                      }
                    />
                  ))}
                </ul>
              )
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No products at this level.
              </div>
            )}
            <DragOverlay>
              {activeDrag && (
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs shadow-lg">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  {activeDrag.name}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewGroupCard({ label, count, onOpen }: { label: string; count: number; onOpen: () => void }) {
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
      >
        <span className="truncate">{label}</span>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
      </button>
    </li>
  );
}

// A group row that's both a drop target (for products dragged from a
// sibling group) and expandable in place to reveal its own products
// (draggable) — mirrors the pattern used by CategoryAdminTab/AttributeAdminTab.
function PreviewGroupRow({
  value,
  label,
  count,
  levels,
  path,
  currentLevel,
}: {
  value: string;
  label: string;
  count: number;
  levels: { attribute_key: string; label: string }[];
  path: { attribute_key: string; value: string; label: string }[];
  currentLevel: { attribute_key: string; label: string };
}) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `previewgroup:${value}`,
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
      </div>

      {open && count > 0 && (
        <div className="mt-2" style={{ marginLeft: 32 }}>
          <PreviewGroupProducts
            levels={levels}
            path={[...path, { attribute_key: currentLevel.attribute_key, value, label }]}
          />
        </div>
      )}
    </li>
  );
}

function PreviewGroupProducts({
  levels,
  path,
}: {
  levels: { attribute_key: string; label: string }[];
  path: { attribute_key: string; value: string; label: string }[];
}) {
  const browseFn = useServerFn(browseTaxonomy);
  const key = useMemo(() => JSON.stringify(path.map((p) => ({ a: p.attribute_key, v: p.value }))), [path]);
  const q = useQuery({
    queryKey: ["taxonomy-preview-group-products", key],
    queryFn: () =>
      browseFn({ data: { dryLevels: levels, path: path.map((p) => ({ attribute_key: p.attribute_key, value: p.value })) } }),
  });

  return (
    <div className="rounded-lg border bg-muted/10 p-2">
      {q.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : q.data?.products?.length ? (
        <ul className="divide-y rounded-md border bg-background">
          {q.data.products.slice(0, 20).map((p: any) => (
            <PreviewProductRow key={p.id} product={p} draggable />
          ))}
          {q.data.products.length > 20 && (
            <li className="px-2 py-1.5 text-center text-[11px] text-muted-foreground">
              +{q.data.products.length - 20} more
            </li>
          )}
        </ul>
      ) : (
        <p className="px-1 py-2 text-xs text-muted-foreground">No products.</p>
      )}
    </div>
  );
}

function PreviewProductRow({ product: p, draggable }: { product: any; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `previewprod:${p.id}`,
    data: draggable ? ({ type: "product", productId: p.id, name: p.name } satisfies DragProductData) : undefined,
    disabled: !draggable,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm bg-background",
        draggable && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-muted">
        {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1 truncate">{p.name}</div>
      {p.stock_qty != null && <Badge variant="outline" className="text-[10px]">{p.stock_qty} qty</Badge>}
    </li>
  );
}
