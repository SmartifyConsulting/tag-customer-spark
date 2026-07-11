import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Tag as TagIcon, Wand2, Combine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { listBrands, upsertBrand, deleteBrand, linkProductsToBrands, mergeDuplicateBrands } from "@/lib/brands.functions";

type Brand = {
  id: string; name: string; slug: string;
  logo_url: string | null; website: string | null; description: string | null;
};

export function BrandAdminTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brands"], queryFn: () => listBrands() });
  const upsertFn = useServerFn(upsertBrand);
  const deleteFn = useServerFn(deleteBrand);
  const mergeFn = useServerFn(mergeDuplicateBrands);
  const linkFn = useServerFn(linkProductsToBrands);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [editing, setEditing] = useState<Brand | null>(null);

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
  const fetchLogo = useMutation({
    mutationFn: (id: string) => logoFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Logo updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Logo failed"),
  });
  const link = useMutation({
    mutationFn: () => linkFn(),
    onSuccess: (r: any) => { invalidate(); toast.success(`Linked ${r?.linked ?? 0} products (${r?.created ?? 0} new brands)`); },
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
            <Button size="sm" variant="outline" onClick={() => link.mutate()} disabled={link.isPending}>
              <Wand2 className="mr-1 h-3.5 w-3.5" /> Auto-link products
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
            {rows.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2">
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
                <Button size="sm" variant="ghost" onClick={() => fetchLogo.mutate(b.id)} disabled={fetchLogo.isPending}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Logo
                </Button>
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
