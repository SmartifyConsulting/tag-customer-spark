import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Store, Plus, MapPin, Users, ScanLine, UserRound, Phone, Upload, Search } from "lucide-react";
import { StoreImportDialog } from "@/components/stores/store-import-dialog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { listStores, upsertStore } from "@/lib/stores.functions";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/stores")({
  head: () => ({ meta: [{ title: "Stores — Tag" }] }),
  component: StoresPage,
});

function money(c: number) {
  return formatMoney(c, "ZAR", { maximumFractionDigits: 0 });
}

const ALL = "__all__";

function StoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState(ALL);
  const [country, setCountry] = useState(ALL);

  const stores = useQuery({ queryKey: ["stores"], queryFn: () => listStores() });
  const allStores = (stores.data ?? []) as any[];

  const provinces = useMemo(
    () => Array.from(new Set(allStores.map((s) => s.province).filter(Boolean))).sort(),
    [allStores],
  );
  const countries = useMemo(
    () => Array.from(new Set(allStores.map((s) => s.country).filter(Boolean))).sort(),
    [allStores],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStores.filter((s) => {
      if (q && !s.name?.toLowerCase().includes(q)) return false;
      if (province !== ALL && s.province !== province) return false;
      if (country !== ALL && s.country !== country) return false;
      return true;
    });
  }, [allStores, search, province, country]);

  const hasFilters = !!search || province !== ALL || country !== ALL;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stores"
        description="Every physical retail location using Tag."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" /> Upload stores
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Add store</Button></DialogTrigger>
              <StoreDialog editing={editing} onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["stores"] }); }} />
            </Dialog>
          </div>
        }
      />
      <StoreImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {!stores.isLoading && allStores.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search branch name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All provinces / states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All provinces / states</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <span className="text-sm text-muted-foreground">{filtered.length} of {allStores.length}</span>
          )}
        </div>
      )}

      {stores.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : allStores.length === 0 ? (
        <EmptyState icon={Store} title="No stores yet" description="Add your first physical store to start assigning staff and tracking engagement." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No stores match" description="Try a different search or filter." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="rounded-2xl">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{s.name}</h3>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {[s.city, s.province, s.country].filter(Boolean).join(", ") || "Location not set"}
                    </p>
                  </div>
                  <Badge variant={s.status === "active" ? "default" : "outline"} className="capitalize">{s.status}</Badge>
                </div>
                <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Store Manager:</span>
                    <span className="truncate text-muted-foreground">{s.manager_name || "Not assigned"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Contact:</span>
                    {s.contact_phone ? (
                      <a href={`tel:${s.contact_phone}`} className="truncate text-[color:var(--mint)] hover:underline">{s.contact_phone}</a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-xs text-muted-foreground"><ScanLine className="mx-auto h-3 w-3" /></p>
                    <p className="text-sm font-semibold">{s.scans}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-xs text-muted-foreground"><Users className="mx-auto h-3 w-3" /></p>
                    <p className="text-sm font-semibold">{s.staff_count}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-xs text-muted-foreground">ZAR</p>
                    <p className="text-sm font-semibold">{money(s.recovered_cents)}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setEditing(s); setOpen(true); }}>Edit</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StoreDialog({ editing, onClose }: { editing: any; onClose: () => void }) {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    address: editing?.address ?? "",
    city: editing?.city ?? "",
    province: editing?.province ?? "",
    country: editing?.country ?? "South Africa",
    timezone: editing?.timezone ?? "Africa/Johannesburg",
    manager_name: editing?.manager_name ?? "",
    contact_phone: editing?.contact_phone ?? "",
    status: (editing?.status as "active" | "closed" | "pending") ?? "active",
  });
  const save = useMutation({
    mutationFn: () => upsertStore({ data: { id: editing?.id, ...form } }),
    onSuccess: () => { toast.success(editing ? "Store updated" : "Store created"); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit store" : "New store"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>Province / State</Label><Input value={form.province ?? ""} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
          <div><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Store Manager</Label><Input value={form.manager_name ?? ""} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} placeholder="Full name" /></div>
          <div><Label>Contact Number</Label><Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+27 …" /></div>
        </div>
        <div><Label>Timezone</Label><Input value={form.timezone ?? ""} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
