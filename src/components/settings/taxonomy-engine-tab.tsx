import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  GripVertical,
  Layers,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  ATTRIBUTE_CATALOG,
  browseTaxonomy,
  deleteProfile,
  getProfile,
  listProfiles,
  publishProfile,
  setDefaultProfile,
  upsertProfile,
} from "@/lib/taxonomy.functions";

type Level = { id?: string; attribute_key: string; label: string; tmpId: string };

export function TaxonomyEngineTab() {
  const qc = useQueryClient();
  const profilesFn = useServerFn(listProfiles);
  const upsertFn = useServerFn(upsertProfile);
  const removeFn = useServerFn(deleteProfile);
  const defaultFn = useServerFn(setDefaultProfile);
  const publishFn = useServerFn(publishProfile);
  const detailFn = useServerFn(getProfile);

  const profilesQ = useQuery({ queryKey: ["taxonomy-profiles"], queryFn: () => profilesFn() });
  const profiles = profilesQ.data?.profiles ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);

  // Load selected profile
  const profileQ = useQuery({
    queryKey: ["taxonomy-profile", selectedId],
    queryFn: () => detailFn({ data: { id: selectedId! } }),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (!profileQ.data) return;
    setName(profileQ.data.profile.name);
    setLevels(
      profileQ.data.levels.map((l: any) => ({
        id: l.id,
        attribute_key: l.attribute_key,
        label: l.label,
        tmpId: crypto.randomUUID(),
      })),
    );
  }, [profileQ.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["taxonomy-profiles"] });
    qc.invalidateQueries({ queryKey: ["taxonomy-profile", selectedId] });
    qc.invalidateQueries({ queryKey: ["taxonomy-active"] });
    qc.invalidateQueries({ queryKey: ["taxonomy-preview"] });
  };

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: selectedId ?? undefined,
          name: name.trim() || "Untitled profile",
          levels: levels.map((l, i) => ({
            attribute_key: l.attribute_key,
            label: l.label.trim() || l.attribute_key,
            position: i,
          })),
        },
      }),
    onSuccess: (r: any) => {
      invalidate();
      setSelectedId(r.id);
      toast.success("Profile saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: () => removeFn({ data: { id: selectedId! } }),
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
      setLevels([]);
      setName("");
      toast.success("Deleted");
    },
  });

  const makeDefault = useMutation({
    mutationFn: () => defaultFn({ data: { id: selectedId! } }),
    onSuccess: () => {
      invalidate();
      toast.success("Set as default");
    },
  });

  const togglePublish = useMutation({
    mutationFn: (publish: boolean) => publishFn({ data: { id: selectedId!, publish } }),
    onSuccess: () => {
      invalidate();
      toast.success("Updated");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = levels.findIndex((l) => l.tmpId === active.id);
    const newIdx = levels.findIndex((l) => l.tmpId === over.id);
    setLevels(arrayMove(levels, oldIdx, newIdx));
  };

  const addLevel = (attribute_key: string) => {
    const cat = ATTRIBUTE_CATALOG.find((a) => a.key === attribute_key);
    if (!cat) return;
    setLevels((cur) => [
      ...cur,
      { attribute_key, label: cat.label, tmpId: crypto.randomUUID() },
    ]);
  };

  const startNew = () => {
    setSelectedId(null);
    setName("New profile");
    setLevels([
      { attribute_key: "brand", label: "Brand", tmpId: crypto.randomUUID() },
      { attribute_key: "category", label: "Category", tmpId: crypto.randomUUID() },
      { attribute_key: "product", label: "Product", tmpId: crypto.randomUUID() },
    ]);
  };

  const isEditing = selectedId !== null || levels.length > 0;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" /> Product Taxonomy Engine
        </CardTitle>
        <CardDescription>
          Configure how the product browser is organised. Drag levels to reorder — the Live Preview refreshes as you edit.
          Publish a profile to make it the active browser layout. Multiple profiles let Retail, Buying, Warehouse and Marketing each browse the same catalogue their own way.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {profiles.length > 0 && (
            <div className="min-w-[220px]">
              <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select profile…" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_default ? " · default" : ""}
                      {p.is_published ? " · published" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={startNew}>
            <Plus className="mr-1 h-3.5 w-3.5" /> New profile
          </Button>
          {selectedId && (
            <>
              <Button size="sm" variant="outline" onClick={() => makeDefault.mutate()}>
                <Star className="mr-1 h-3.5 w-3.5" /> Set default
              </Button>
              <Button
                size="sm"
                variant={profileQ.data?.profile.is_published ? "secondary" : "default"}
                onClick={() => togglePublish.mutate(!profileQ.data?.profile.is_published)}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                {profileQ.data?.profile.is_published ? "Unpublish" : "Publish"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => confirm(`Delete "${name}"?`) && remove.mutate()}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
        </div>

        {profilesQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !isEditing && profiles.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No taxonomy profiles yet"
            description="Create your first profile to control how the product browser groups items."
          />
        ) : !isEditing ? (
          <p className="text-sm text-muted-foreground">Select or create a profile to edit its hierarchy.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Editor */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Profile name
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Hierarchy (drag to reorder)
                  </label>
                  <AttributePicker onPick={addLevel} used={levels.map((l) => l.attribute_key)} />
                </div>

                {levels.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Add levels using the picker above.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={levels.map((l) => l.tmpId)} strategy={verticalListSortingStrategy}>
                      <ol className="space-y-2">
                        {levels.map((l, idx) => (
                          <SortableLevel
                            key={l.tmpId}
                            level={l}
                            index={idx}
                            onLabelChange={(v) =>
                              setLevels((cur) => cur.map((x) => (x.tmpId === l.tmpId ? { ...x, label: v } : x)))
                            }
                            onAttrChange={(v) =>
                              setLevels((cur) => cur.map((x) => (x.tmpId === l.tmpId ? { ...x, attribute_key: v } : x)))
                            }
                            onRemove={() => setLevels((cur) => cur.filter((x) => x.tmpId !== l.tmpId))}
                          />
                        ))}
                      </ol>
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
                  <Save className="mr-1 h-4 w-4" /> Save profile
                </Button>
              </div>
            </div>

            {/* Live preview */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Live preview
                </label>
                <span className="text-[10px] text-muted-foreground">Uses your live catalogue</span>
              </div>
              <TaxonomyPreview
                levels={levels.map((l) => ({ attribute_key: l.attribute_key, label: l.label }))}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttributePicker({ onPick, used }: { onPick: (k: string) => void; used: string[] }) {
  const [open, setOpen] = useState(false);
  const available = ATTRIBUTE_CATALOG.filter(
    (a) => a.key === "product" || !used.includes(a.key),
  );
  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add level
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
          {available.map((a) => (
            <button
              key={a.key}
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onPick(a.key);
                setOpen(false);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableLevel({
  level,
  index,
  onLabelChange,
  onAttrChange,
  onRemove,
}: {
  level: Level;
  index: number;
  onLabelChange: (v: string) => void;
  onAttrChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: level.tmpId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-xl border bg-card p-2 shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Badge variant="secondary" className="w-6 justify-center">
        {index + 1}
      </Badge>
      <Select value={level.attribute_key} onValueChange={onAttrChange}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ATTRIBUTE_CATALOG.map((a) => (
            <SelectItem key={a.key} value={a.key}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={level.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="h-8 flex-1"
        placeholder="Display label"
      />
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function TaxonomyPreview({
  levels,
}: {
  levels: { attribute_key: string; label: string }[];
}) {
  const browse = useServerFn(browseTaxonomy);
  const [path, setPath] = useState<{ attribute_key: string; value: string; label: string }[]>([]);

  // Reset when hierarchy shape changes.
  useEffect(() => {
    setPath([]);
  }, [levels.map((l) => l.attribute_key).join("|")]);

  const key = useMemo(
    () => JSON.stringify({ levels, path: path.map((p) => ({ a: p.attribute_key, v: p.value })) }),
    [levels, path],
  );

  const q = useQuery({
    queryKey: ["taxonomy-preview", key],
    queryFn: () =>
      browse({
        data: {
          dryLevels: levels,
          path: path.map((p) => ({ attribute_key: p.attribute_key, value: p.value })),
        },
      }),
    enabled: levels.length > 0,
  });

  if (!levels.length) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Add hierarchy levels to preview the browser.
      </div>
    );
  }

  const currentLevel = levels[path.length];

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      {/* Breadcrumbs */}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
        <button
          onClick={() => setPath([])}
          className="rounded px-2 py-1 hover:bg-accent"
        >
          All
        </button>
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => setPath((cur) => cur.slice(0, i + 1))}
              className="rounded px-2 py-1 hover:bg-accent"
            >
              {p.label}
            </button>
          </span>
        ))}
      </div>

      {currentLevel && (
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Grouping by: {currentLevel.label}
        </div>
      )}

      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.data?.products && q.data.products.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-background">
          {q.data.products.slice(0, 30).map((p: any) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1 truncate">{p.name}</div>
              {p.stock_qty != null && (
                <Badge variant="outline" className="text-[10px]">{p.stock_qty} qty</Badge>
              )}
            </li>
          ))}
        </ul>
      ) : q.data?.groups && q.data.groups.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {q.data.groups.map((g: any) => (
            <li key={g.value}>
              <button
                onClick={() =>
                  setPath((cur) => [
                    ...cur,
                    { attribute_key: currentLevel!.attribute_key, value: g.value, label: g.label },
                  ])
                }
                className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">{g.label}</span>
                <Badge variant="secondary" className="text-[10px]">{g.count}</Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No products at this level.
        </div>
      )}
    </div>
  );
}
