import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, FolderTree, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  listCategoriesWithCounts,
  createCategory,
  renameCategory,
  deleteCategory,
  bulkAutoCategorise,
} from "@/lib/categories.functions";

type Row = { id: string; name: string; parent_id: string | null; status: string };

export function CategoryAdminTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["categories", "with-counts"], queryFn: () => listCategoriesWithCounts() });
  const createFn = useServerFn(createCategory);
  const renameFn = useServerFn(renameCategory);
  const deleteFn = useServerFn(deleteCategory);
  const bulkFn = useServerFn(bulkAutoCategorise);

  const [newParent, setNewParent] = useState("");
  const [subFor, setSubFor] = useState<string | null>(null);
  const [subName, setSubName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["products"] });
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
    onSuccess: () => { invalidate(); setEditing(null); toast.success("Renamed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const { parents, childrenOf } = useMemo(() => {
    const rows = (q.data?.rows ?? []) as Row[];
    const parents = rows.filter((r) => !r.parent_id);
    const childrenOf = new Map<string, Row[]>();
    for (const r of rows) {
      if (r.parent_id) {
        const arr = childrenOf.get(r.parent_id) ?? [];
        arr.push(r);
        childrenOf.set(r.parent_id, arr);
      }
    }
    return { parents, childrenOf };
  }, [q.data]);

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FolderTree className="h-5 w-5" /> Category admin</CardTitle>
        <CardDescription>Manage product categories and their sub-categories (e.g. Men → Shirts, Women → Dresses).</CardDescription>
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
        ) : parents.length === 0 ? (
          <EmptyState icon={FolderTree} title="No categories yet" description="Add a top-level category to get started." />
        ) : (
          <ul className="divide-y rounded-xl border">
            {parents.map((p) => {
              const kids = childrenOf.get(p.id) ?? [];
              const open = openIds.has(p.id);
              return (
                <li key={p.id} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
                      aria-label={open ? "Collapse" : "Expand"}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {editing?.id === p.id ? (
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && rename.mutate(editing)}
                        className="h-8 max-w-xs"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {q.data?.counts?.[p.id] ?? 0} products · {kids.length} sub
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setSubFor(subFor === p.id ? null : p.id)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Sub
                    </Button>
                    {editing?.id === p.id ? (
                      <Button size="sm" onClick={() => rename.mutate(editing)}>Save</Button>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing({ id: p.id, name: p.name })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => confirm(`Delete "${p.name}" and all sub-categories?`) && remove.mutate(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {subFor === p.id && (
                    <form
                      className="mt-2 ml-9 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!subName.trim()) return;
                        create.mutate(
                          { name: subName.trim(), parent_id: p.id },
                          {
                            onSuccess: () => {
                              setSubName("");
                              setSubFor(null);
                              setOpenIds((s) => new Set(s).add(p.id));
                            },
                          },
                        );
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

                  {open && kids.length > 0 && (
                    <ul className="mt-2 ml-9 space-y-1">
                      {kids.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/40">
                          {editing?.id === c.id ? (
                            <Input
                              value={editing.name}
                              onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                              className="h-7 max-w-xs"
                              autoFocus
                            />
                          ) : (
                            <>
                              <span className="flex-1 text-sm">{c.name}</span>
                              <span className="text-[11px] text-muted-foreground">{q.data?.counts?.[c.id] ?? 0}</span>
                            </>
                          )}
                          {editing?.id === c.id ? (
                            <Button size="sm" onClick={() => rename.mutate(editing)}>Save</Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing({ id: c.id, name: c.name })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => confirm(`Delete "${c.name}"?`) && remove.mutate(c.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
