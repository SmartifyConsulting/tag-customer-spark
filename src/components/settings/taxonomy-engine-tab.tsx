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
  Eye,
  EyeOff,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import {
  ATTRIBUTE_CATALOG,
  browseTaxonomy,
  deleteProfile,
  getProfile,
  listProfiles,
  publishProfile,
  seedSectorTemplates,
  setDefaultProfile,
  upsertProfile,
} from "@/lib/taxonomy.functions";
import { TAXONOMY_TEMPLATES, type TaxonomyTemplate } from "@/lib/taxonomy-templates";

type Level = { id?: string; attribute_key: string; label: string; hidden: boolean; tmpId: string };

export function TaxonomyEngineTab() {
  const qc = useQueryClient();
  const profilesFn = useServerFn(listProfiles);
  const upsertFn = useServerFn(upsertProfile);
  const removeFn = useServerFn(deleteProfile);
  const defaultFn = useServerFn(setDefaultProfile);
  const publishFn = useServerFn(publishProfile);
  const detailFn = useServerFn(getProfile);
  const seedFn = useServerFn(seedSectorTemplates);

  const profilesQ = useQuery({ queryKey: ["taxonomy-profiles"], queryFn: () => profilesFn() });
  const profiles = profilesQ.data?.profiles ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [autoSeedTried, setAutoSeedTried] = useState(false);

  // Auto-seed sector templates on first render if the retailer has none, so
  // the grid isn't empty and the user can pick one immediately rather than
  // clicking through "New profile" first.
  useEffect(() => {
    if (autoSeedTried || profilesQ.isLoading || profiles.length > 0) return;
    setAutoSeedTried(true);
    seedFn()
      .then(() => qc.invalidateQueries({ queryKey: ["taxonomy-profiles"] }))
      .catch(() => {/* silent — user can click "Load sector templates" manually */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesQ.isLoading, profiles.length]);

  // Auto-select whichever profile is live (published, else default, else the
  // first one) as soon as the list loads, so the taxonomy that was actually
  // detected/applied on import shows up ready to edit instead of an empty
  // "Select or create a profile" state the user has to click through.
  useEffect(() => {
    if (selectedId || profiles.length === 0) return;
    const pick =
      profiles.find((p: any) => p.is_published) ??
      profiles.find((p: any) => p.is_default) ??
      profiles[0];
    if (pick) setSelectedId(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);


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
        hidden: l.hidden ?? false,
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
            hidden: l.hidden,
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
    onSuccess: (_r, publish) => {
      invalidate();
      toast.success(
        publish
          ? `Inventory browser now uses "${name}". Existing products are unchanged.`
          : "Unpublished — the browser falls back to the default profile.",
      );
    },
  });

  const seedTemplates = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (r: any) => {
      invalidate();
      if (r.created === 0) toast.info("All sector templates are already loaded.");
      else toast.success(`Added ${r.created} sector templates. Pick one from the dropdown.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not load templates"),
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
      { attribute_key, label: cat.label, hidden: false, tmpId: crypto.randomUUID() },
    ]);
  };

  const addCustomLevel = (label: string) => {
    const slug = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (!slug) return;
    setLevels((cur) => [
      ...cur,
      { attribute_key: `custom:${slug}`, label: label.trim(), hidden: false, tmpId: crypto.randomUUID() },
    ]);
  };

  const startBlank = () => {
    setSelectedId(null);
    setName("New profile");
    setLevels([
      { attribute_key: "brand", label: "Brand", hidden: false, tmpId: crypto.randomUUID() },
      { attribute_key: "category", label: "Category", hidden: false, tmpId: crypto.randomUUID() },
      { attribute_key: "product", label: "Product", hidden: false, tmpId: crypto.randomUUID() },
    ]);
  };

  const startFromTemplate = (template: TaxonomyTemplate) => {
    setSelectedId(null);
    setName(template.name);
    setLevels(
      template.levels.map((l) => ({
        attribute_key: l.attribute_key,
        label: l.label,
        hidden: false,
        tmpId: crypto.randomUUID(),
      })),
    );
  };

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const isEditing = selectedId !== null || levels.length > 0;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" /> Product Taxonomy Engine
        </CardTitle>
        <CardDescription>
          Configure how the product browser is organised. Drag levels to reorder — the Live Preview refreshes as you edit.
          <br />
          <strong>Publish</strong> makes the selected hierarchy the one the Inventory browser uses to group products. It does not add or remove any products.
          Multiple profiles let Retail, Buying, Warehouse and Marketing each browse the same catalogue their own way.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setTemplatePickerOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> New profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => seedTemplates.mutate()}
            disabled={seedTemplates.isPending}
            title="Add every built-in sector template (Fashion, Grocery, Pharmacy, …) as ready-to-pick profiles"
          >
            <Layers className="mr-1 h-3.5 w-3.5" />
            {seedTemplates.isPending ? "Loading…" : "Load sector templates"}
          </Button>
          {selectedId && (
            <>
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

        {/* Profile grid — every template shown as a picker card. */}
        {profiles.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Templates ({profiles.length})
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((p: any) => {
                const isSelected = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border px-3 py-2 text-left transition hover:bg-accent",
                      isSelected && "border-primary bg-accent",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      {p.is_default && (
                        <Badge variant="secondary" className="shrink-0 gap-0.5 px-1.5 py-0 text-[10px]">
                          <Star className="h-2.5 w-2.5 fill-current" /> Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {p.is_published && <Badge variant="outline" className="px-1 py-0 text-[10px]">Published</Badge>}
                      {isSelected && !p.is_default && (
                        <span
                          role="button"
                          className="cursor-pointer text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            makeDefault.mutate();
                          }}
                        >
                          Set as default
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {profilesQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !isEditing && profiles.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No taxonomy profiles yet"
            description="Loading sector templates… if none appear, click 'Load sector templates' above."
          />
        ) : !isEditing ? (
          <p className="text-sm text-muted-foreground">Select a template above to edit its hierarchy.</p>
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
                  <AttributePicker
                    onPick={addLevel}
                    onPickCustom={addCustomLevel}
                    used={levels.map((l) => l.attribute_key)}
                  />
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
                            onToggleHidden={() =>
                              setLevels((cur) => cur.map((x) => (x.tmpId === l.tmpId ? { ...x, hidden: !x.hidden } : x)))
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
                levels={levels.map((l) => ({ attribute_key: l.attribute_key, label: l.label, hidden: l.hidden }))}
              />
            </div>
          </div>
        )}
      </CardContent>

      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onPickBlank={() => {
          startBlank();
          setTemplatePickerOpen(false);
        }}
        onPickTemplate={(t) => {
          startFromTemplate(t);
          setTemplatePickerOpen(false);
        }}
      />
    </Card>
  );
}

function TemplatePickerDialog({
  open,
  onOpenChange,
  onPickBlank,
  onPickTemplate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPickBlank: () => void;
  onPickTemplate: (t: TaxonomyTemplate) => void;
}) {
  const groups: TaxonomyTemplate["group"][] = ["Retail", "Wholesale"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start a new profile</DialogTitle>
          <DialogDescription>
            Pick a template close to your business and adjust it, or start from scratch.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <button
            className="flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={onPickBlank}
          >
            <span className="font-medium">Blank profile</span>
            <span className="text-xs text-muted-foreground">Brand → Category → Product</span>
          </button>
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group}
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {TAXONOMY_TEMPLATES.filter((t) => t.group === group).map((t) => (
                  <li key={t.id}>
                    <button
                      className="flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => onPickTemplate(t)}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                      <span className="mt-1 text-[10px] text-muted-foreground">
                        {t.levels.map((l) => l.label).join(" → ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttributePicker({
  onPick,
  onPickCustom,
  used,
}: {
  onPick: (k: string) => void;
  onPickCustom: (label: string) => void;
  used: string[];
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const available = ATTRIBUTE_CATALOG.filter(
    (a) => a.key === "product" || !used.includes(a.key),
  );
  const closeAll = () => {
    setOpen(false);
    setCustomOpen(false);
    setCustomLabel("");
  };
  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add level
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border bg-popover p-1 shadow-md">
          {available.length === 0 && !customOpen && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Every built-in attribute is already in this hierarchy.
            </p>
          )}
          {available.map((a) => (
            <button
              key={a.key}
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onPick(a.key);
                closeAll();
              }}
            >
              {a.label}
            </button>
          ))}
          <div className="my-1 border-t" />
          {customOpen ? (
            <form
              className="flex gap-1 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!customLabel.trim()) return;
                onPickCustom(customLabel);
                closeAll();
              }}
            >
              <Input
                autoFocus
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Material"
                className="h-7 flex-1 text-xs"
              />
              <Button size="sm" type="submit" className="h-7 px-2 text-xs">
                Add
              </Button>
            </form>
          ) : (
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
              onClick={() => setCustomOpen(true)}
            >
              <Plus className="mr-1 inline h-3 w-3" /> Custom level…
            </button>
          )}
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
  onToggleHidden,
  onRemove,
}: {
  level: Level;
  index: number;
  onLabelChange: (v: string) => void;
  onAttrChange: (v: string) => void;
  onToggleHidden: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: level.tmpId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : level.hidden ? 0.55 : 1,
  };
  const isCustom = level.attribute_key.startsWith("custom:");
  const selectOptions = isCustom
    ? [...ATTRIBUTE_CATALOG, { key: level.attribute_key, label: level.label || level.attribute_key }]
    : ATTRIBUTE_CATALOG;
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
          {selectOptions.map((a) => (
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
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={onToggleHidden}
        title={level.hidden ? "Hidden — click to show in the browser" : "Visible — click to hide"}
      >
        {level.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function TaxonomyPreview({
  levels: rawLevels,
}: {
  levels: { attribute_key: string; label: string; hidden?: boolean }[];
}) {
  const browse = useServerFn(browseTaxonomy);
  const [path, setPath] = useState<{ attribute_key: string; value: string; label: string }[]>([]);

  // Hidden levels are skipped server-side, so index by the same visible-only
  // list here to keep breadcrumb/depth positions in sync.
  const levels = useMemo(() => rawLevels.filter((l) => !l.hidden), [rawLevels]);

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
