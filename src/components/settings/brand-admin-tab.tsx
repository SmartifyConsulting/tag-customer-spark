import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Tag as TagIcon, Wand2, GitMerge, ChevronDown, ChevronRight, Package } from "lucide-react";
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
  listBrands,
  upsertBrand,
  deleteBrand,
  linkProductsToBrands,
  mergeBrands,
  backfillBrandLogos,
} from "@/lib/brands.functions";
import { listProducts } from "@/lib/products.functions";

type Brand = {
  id: string; name: string; slug: string;
  logo_url: string | null; website: string | null; description: string | null;
};

export function BrandAdminTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brands"], queryFn: () => listBrands() });
  const upsertFn = useServerFn(upsertBrand);
  const deleteFn = useServerFn(deleteBrand);
  const linkFn = useServerFn(linkProductsToBrands);
  const backfillLogosFn = useServerFn(backfillBrandLogos);

  // Silently retry a few missing brand logos each time this tab loads — a
  // fresh import creates brands without logos (fetching them synchronously
  // during import made the setup wizard hang), so this fills them in over a
  // few visits instead. Same pattern as Admin > Inventory's image backfill.
  const logoBackfillRan = useRef(false);
  useEffect(() => {
    if (logoBackfillRan.current) return;
    logoBackfillRan.current = true;
    (async () => {
      for (let i = 0; i < 5; i++) {
        const res = await backfillLogosFn().catch(() => null);
        if (!res || res.processed === 0) break;
        if (res.logos > 0) qc.invalidateQueries({ queryKey: ["brands"] });
        if (res.processed < 5) break;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [editing, setEditing] = useState<Brand | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["brands"] });

  const create = useMutation({
    mutationFn: (v: { name: string; website?: string | null }) => upsertFn({ data: v }),
    onSuccess: () => { invalidate(); setName(""); setWebsite(""); toast.success("Brand added"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const save = useMutation({
    mutationFn: (v: Brand) => upsertFn({ data: { id: v.id, name: v.name, website: v.website, description: v.description } }),
    onSuccess: () => { invalidate(); setEditing(null); toast.success("Saved"); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Deleted"); },
  });
  const link = useMutation({
    mutationFn: () => linkFn(),
    onSuccess: (r: any) => { invalidate(); toast.success(`Linked ${r?.linked ?? 0} products · ${r?.created ?? 0} new brands · ${r?.logos ?? 0} logos fetched`); },
  });

  const rows = (q.data?.rows ?? []) as Brand[];
  const counts = q.data?.counts ?? {};
  const missingLogos = rows.filter((r) => !r.logo_url).length;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><TagIcon className="h-5 w-5" /> Brand admin</CardTitle>
        <CardDescription>Brands and their logos. Logos appear beside product names in the Inventory list.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <div className="text-sm">
            <span className="font-medium">{rows.length}</span>{" "}
            <span className="text-muted-foreground">brands</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="font-medium">{missingLogos}</span>{" "}
            <span className="text-muted-foreground">missing logos</span>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
              <GitMerge className="mr-1 h-3.5 w-3.5" /> Merge
            </Button>
            <Button size="sm" onClick={() => link.mutate()} disabled={link.isPending}>
              <Wand2 className="mr-1 h-3.5 w-3.5" /> Auto-link & fetch logos
            </Button>
          </div>
        </div>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate({ name: name.trim(), website: website.trim() || null });
          }}
        >
          <Input placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="Website (optional, helps auto-fetch logo)" value={website} onChange={(e) => setWebsite(e.target.value)} className="max-w-sm" />
          <Button type="submit" disabled={create.isPending}><Plus className="mr-1 h-4 w-4" /> Add brand</Button>
        </form>

        {q.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={TagIcon} title="No brands yet" description="Add your first brand, or auto-link from existing products." />
        ) : (
          <ul className="divide-y rounded-xl border">
            {rows.map((b) => {
              const open = openId === b.id;
              return (
                <li key={b.id} className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : b.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded hover:bg-muted"
                      aria-label={open ? "Collapse" : "Expand"}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-white">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt={b.name} className="h-full w-full object-contain" />
                      ) : (
                        <TagIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {editing?.id === b.id ? (
                        <div className="flex flex-wrap gap-2">
                          <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8 max-w-xs" />
                          <Input value={editing.website ?? ""} placeholder="website" onChange={(e) => setEditing({ ...editing, website: e.target.value })} className="h-8 max-w-sm" />
                        </div>
                      ) : (
                        <>
                          <div className="truncate text-sm font-medium">{b.name}</div>
                          {b.website && <div className="truncate text-xs text-muted-foreground">{b.website}</div>}
                        </>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{counts[b.id] ?? 0} products</span>
                    {editing?.id === b.id ? (
                      <Button size="sm" onClick={() => save.mutate(editing)}>Save</Button>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(b)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => confirm(`Delete "${b.name}"?`) && remove.mutate(b.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {open && (
                    <div className="mt-2 ml-16">
                      <BrandProductsPanel brandId={b.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <MergeBrandsDialog open={mergeOpen} onOpenChange={setMergeOpen} onMerged={invalidate} />
    </Card>
  );
}

function BrandProductsPanel({ brandId }: { brandId: string }) {
  const listFn = useServerFn(listProducts);
  const productsQ = useQuery({
    queryKey: ["brand-products", brandId],
    queryFn: () => listFn({ data: { brand_id: brandId, pageSize: 20, status: "all" } }),
  });

  return (
    <div className="rounded-lg border bg-muted/10 p-2">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Products for this brand
      </div>
      {productsQ.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : productsQ.data?.rows?.length ? (
        <ul className="divide-y rounded-md border bg-background">
          {productsQ.data.rows.map((p: any) => (
            <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <div className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-3 w-3 text-muted-foreground" />}
              </div>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.sku && <span className="text-muted-foreground">{p.sku}</span>}
              <Badge variant="outline" className="text-[10px]">{p.stock_qty ?? 0} qty</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-xs text-muted-foreground">No products for this brand.</p>
      )}
    </div>
  );
}

function MergeBrandsDialog({
  open,
  onOpenChange,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMerged: () => void;
}) {
  const listFn = useServerFn(listBrands);
  const mergeFn = useServerFn(mergeBrands);
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["brands-for-merge"],
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
      toast.success(`Merged ${r.merged} brand${r.merged === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["brands-for-merge"] });
      setChecked(new Set());
      setTarget(null);
      onMerged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Merge failed"),
  });

  const rows = (listQ.data?.rows ?? []) as Brand[];
  const counts = listQ.data?.counts ?? {};

  const items = rows
    .map((b) => ({ id: b.id, name: b.name, count: counts[b.id] ?? 0 }))
    .filter((b) => !search.trim() || b.name.toLowerCase().includes(search.trim().toLowerCase()))
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
          <DialogTitle>Merge brands</DialogTitle>
          <DialogDescription>
            Select any brands to merge and choose which one survives — nothing merges automatically.
          </DialogDescription>
        </DialogHeader>

        <Input placeholder="Search brands…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <ScrollArea className="max-h-[45vh] pr-3">
          {listQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No brands match.</p>
          ) : (
            <RadioGroup value={target ?? undefined} onValueChange={setTarget}>
              <ul className="space-y-1">
                {items.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/40">
                    <Checkbox checked={checked.has(b.id)} onCheckedChange={() => toggle(b.id)} />
                    <RadioGroupItem value={b.id} disabled={!checked.has(b.id)} />
                    <span className="min-w-0 flex-1 truncate">{b.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{b.count} products</Badge>
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
