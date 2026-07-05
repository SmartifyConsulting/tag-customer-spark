import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Edit,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listCustomers, getCustomerDetail, deleteCustomer } from "@/lib/customers.functions";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — Tag" }] }),
  component: CustomersPage,
});

function money(c?: number | null) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format((c ?? 0) / 100);
}

const LETTERS = ["all", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"] as const;

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"all" | "subscribed" | "vip" | "dormant">("all");
  const [letter, setLetter] = useState<(typeof LETTERS)[number]>("all");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteCustomer);

  const list = useQuery({
    queryKey: ["customers", "list", search, segment, letter, page],
    queryFn: () => listCustomers({ data: { search, segment, letter, page, pageSize: 25 } }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="Shoppers who opted in to WhatsApp updates via your QR tags."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add customer
          </Button>
        }
      />

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={segment} onValueChange={(v) => { setSegment(v as any); setPage(1); }}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="subscribed">Subscribed</TabsTrigger>
              <TabsTrigger value="vip">VIP</TabsTrigger>
              <TabsTrigger value="dormant">Dormant</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 w-64 pl-8" placeholder="Search name or number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span>Customer</span><span>Status</span><span>Scans</span><span>Interests</span><span>Revenue</span><span></span>
            </div>
            {list.isLoading ? (
              <div className="space-y-3 p-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (list.data?.rows ?? []).length === 0 ? (
              <div className="p-6"><EmptyState icon={Users} title="No customers yet" description="Customers appear here after their first QR scan and opt-in." /></div>
            ) : (list.data!.rows as any[]).map((c) => (
              <div key={c.id} className="grid w-full grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 px-6 py-3 hover:bg-muted/40">
                <button onClick={() => setActiveId(c.id)} className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium">{c.full_name || "Unnamed"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.whatsapp_e164}</p>
                </button>
                <Badge variant={c.status === "subscribed" ? "success" : "outline"} className="w-fit capitalize">{c.status}</Badge>
                <span className="text-sm tabular-nums">{c.scans}</span>
                <span className="text-sm tabular-nums">{c.interests}</span>
                <span className="text-sm tabular-nums">{money(c.lifetime_revenue_cents)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveId(c.id)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                    aria-label="Open"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditRow(c)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/inbox">
                          <MessageSquare className="mr-2 h-4 w-4" /> Message
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete ${c.full_name || c.whatsapp_e164}?`)) {
                            remove.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
          {(list.data?.total ?? 0) > 25 && (
            <div className="flex items-center justify-between border-t px-6 py-3 text-sm">
              <span className="text-muted-foreground">Page {page} of {Math.ceil((list.data?.total ?? 0) / 25)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * 25 >= (list.data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDrawer id={activeId} onClose={() => setActiveId(null)} />
      <CustomerFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editRow && (
        <CustomerFormDialog
          open={!!editRow}
          onOpenChange={(v) => !v && setEditRow(null)}
          initial={editRow}
        />
      )}
    </div>
  );
}


function CustomerDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomerDetail({ data: { id: id! } }),
    enabled: !!id,
  });
  const c = detail.data?.customer as any;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {!c ? <Skeleton className="h-10 w-full" /> : (
          <>
            <SheetHeader>
              <SheetTitle>{c.full_name || "Unnamed"}</SheetTitle>
              <SheetDescription>{c.whatsapp_e164} · since {new Date(c.created_at).toLocaleDateString()}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="Scans" value={detail.data!.scans.length} />
              <Stat label="Interests" value={detail.data!.interests.length} />
              <Stat label="Recoveries" value={detail.data!.recoveries.length} />
            </div>
            <Section title="Interests">
              {detail.data!.interests.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : detail.data!.interests.map((i: any) => (
                <div key={i.id} className="flex items-center gap-3 rounded-lg border p-2">
                  {i.product?.image_url ? <img src={i.product.image_url} className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                  <p className="flex-1 truncate text-sm">{i.product?.name}</p>
                  <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </Section>
            <Section title="Recent scans">
              {detail.data!.scans.length === 0 ? <p className="text-sm text-muted-foreground">No scans yet.</p> : detail.data!.scans.slice(0, 8).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{s.product?.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(s.scanned_at).toLocaleString()}</span>
                </div>
              ))}
            </Section>
            <Section title="Conversations">
              {detail.data!.conversations.length === 0 ? <p className="text-sm text-muted-foreground">No messages.</p> : detail.data!.conversations.map((cv: any) => (
                <Link to="/inbox" key={cv.id} className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{cv.subject ?? "Conversation"}</p>
                    <p className="text-xs text-muted-foreground">{cv.status}</p>
                  </div>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
function Section({ title, children }: any) {
  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
