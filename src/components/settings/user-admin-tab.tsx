import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserCog, ShieldOff, ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listStaff, inviteStaff, updateStaff, updateStaffStatus, deleteStaff } from "@/lib/staff.functions";

type Role = "retail_admin" | "store_manager" | "sales_assistant";
type Staff = {
  id: string;
  full_name: string;
  invite_email: string;
  role: Role | "super_admin";
  status: "active" | "invited" | "disabled";
  store: { id: string; name: string } | null;
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  retail_admin: "Retail Admin",
  store_manager: "Store Manager",
  sales_assistant: "Sales Assistant",
};

export function UserAdminTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["user-admin", "staff"], queryFn: () => listStaff() });
  const setStatusFn = useServerFn(updateStaffStatus);
  const deleteFn = useServerFn(deleteStaff);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["user-admin"] });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "active" | "invited" | "disabled" }) => setStatusFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = (q.data?.staff ?? []) as Staff[];
  const stores = q.data?.stores ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> User admin</CardTitle>
          <CardDescription>Staff accounts across the workspace — invite, edit roles, enable, disable, or remove.</CardDescription>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Invite</Button>
          </DialogTrigger>
          <InviteDialog stores={stores} onDone={() => { setInviteOpen(false); invalidate(); }} />
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState icon={UserCog} title="No staff yet" description="Invite your first team member above." /></div>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span>Name</span><span>Email</span><span>Role</span><span>Status</span><span />
            </div>
            {rows.map((s) => (
              <div key={s.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] items-center gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.full_name || "—"}</p>
                  {s.store?.name && <p className="truncate text-xs text-muted-foreground">{s.store.name}</p>}
                </div>
                <span className="truncate text-sm">{s.invite_email}</span>
                <span className="text-sm">{ROLE_LABEL[s.role] ?? s.role}</span>
                <Badge variant={s.status === "active" ? "success" : s.status === "disabled" ? "outline" : "secondary"} className="w-fit capitalize">
                  {s.status}
                </Badge>
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {s.status !== "disabled" ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "disabled" })}>
                      <ShieldOff className="mr-1 h-3.5 w-3.5" /> Disable
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "active" })}>
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Enable
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => confirm(`Remove ${s.full_name || s.invite_email}?`) && remove.mutate(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <EditDialog
            staff={editing}
            stores={stores}
            onDone={() => { setEditing(null); invalidate(); }}
          />
        )}
      </Dialog>
    </Card>
  );
}

function InviteDialog({ stores, onDone }: { stores: any[]; onDone: () => void }) {
  const inviteFn = useServerFn(inviteStaff);
  const [form, setForm] = useState<{ email: string; full_name: string; role: Role; store_id: string | null }>({
    email: "", full_name: "", role: "sales_assistant", store_id: null,
  });
  const invite = useMutation({
    mutationFn: () => inviteFn({ data: form }),
    onSuccess: () => { toast.success("Invitation sent"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="retail_admin">Retail Admin</SelectItem>
              <SelectItem value="store_manager">Store Manager</SelectItem>
              <SelectItem value="sales_assistant">Sales Assistant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Store (optional)</Label>
          <Select value={form.store_id ?? "none"} onValueChange={(v) => setForm({ ...form, store_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific store</SelectItem>
              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => invite.mutate()} disabled={invite.isPending || !form.email || !form.full_name}>
          Send invite
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditDialog({ staff, stores, onDone }: { staff: Staff; stores: any[]; onDone: () => void }) {
  const updateFn = useServerFn(updateStaff);
  const [form, setForm] = useState<{ full_name: string; role: Role; store_id: string | null }>({
    full_name: staff.full_name,
    role: staff.role === "super_admin" ? "retail_admin" : staff.role,
    store_id: staff.store?.id ?? null,
  });
  const save = useMutation({
    mutationFn: () => updateFn({ data: { id: staff.id, ...form } }),
    onSuccess: () => { toast.success("Saved"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Edit {staff.invite_email}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="retail_admin">Retail Admin</SelectItem>
              <SelectItem value="store_manager">Store Manager</SelectItem>
              <SelectItem value="sales_assistant">Sales Assistant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Store (optional)</Label>
          <Select value={form.store_id ?? "none"} onValueChange={(v) => setForm({ ...form, store_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific store</SelectItem>
              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.full_name}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
