import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserCog, Plus, ShieldCheck, Pause, Play } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { listStaff, inviteStaff, updateStaffStatus } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Tag" }] }),
  component: StaffPage,
});

const ROLE_LABEL: Record<string, string> = {
  retail_admin: "Retail Admin",
  store_manager: "Store Manager",
  sales_assistant: "Sales Assistant",
};

function StaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const data = useQuery({ queryKey: ["staff"], queryFn: () => listStaff() });

  const toggle = useMutation({
    mutationFn: (v: { id: string; status: "active" | "disabled" }) => updateStaffStatus({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Staff"
        description="Invite team members and assign roles. Roles control what each user can see and do across Tag."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Invite</Button></DialogTrigger>
            <InviteDialog stores={data.data?.stores ?? []} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["staff"] }); }} />
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Super Administrator", desc: "Full platform access." },
          { label: "Retail Administrator", desc: "Full retailer + billing." },
          { label: "Store Manager", desc: "Manage one store." },
          { label: "Sales Assistant", desc: "Read-only access." },
        ].map((r) => (
          <Card key={r.label} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">{r.label}</span></div>
              <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Team</CardTitle><CardDescription>Everyone who has access to this workspace.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.isLoading ? (
              <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (data.data?.staff ?? []).length === 0 ? (
              <div className="p-6"><EmptyState icon={UserCog} title="No team members yet" description="Invite your first colleague to get started." /></div>
            ) : (data.data!.staff as any[]).map((s) => (
              <div key={s.id} className="grid grid-cols-1 gap-3 px-6 py-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.invite_email}</p>
                </div>
                <Badge variant="outline">{ROLE_LABEL[s.role] ?? s.role}</Badge>
                <span className="text-sm text-muted-foreground">{s.store?.name ?? "—"}</span>
                <Badge variant={s.status === "active" ? "default" : "outline"} className="w-fit capitalize">{s.status}</Badge>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: s.id, status: s.status === "active" ? "disabled" : "active" })}>
                    {s.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InviteDialog({ stores, onDone }: { stores: any[]; onDone: () => void }) {
  const [form, setForm] = useState<{ email: string; full_name: string; role: "retail_admin" | "store_manager" | "sales_assistant"; store_id: string | null }>({
    email: "", full_name: "", role: "sales_assistant", store_id: null,
  });
  const invite = useMutation({
    mutationFn: () => inviteStaff({ data: form }),
    onSuccess: () => { toast.success("Invitation queued"); onDone(); },
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
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="retail_admin">Retail Administrator</SelectItem>
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
        <Button onClick={() => invite.mutate()} disabled={invite.isPending || !form.email || !form.full_name}>Send invite</Button>
      </DialogFooter>
    </DialogContent>
  );
}
