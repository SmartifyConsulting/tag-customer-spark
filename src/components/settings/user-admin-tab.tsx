import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserCog, ShieldOff, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { listStaff, updateStaffStatus } from "@/lib/staff.functions";

export function UserAdminTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["user-admin", "staff"], queryFn: () => listStaff() });
  const setStatusFn = useServerFn(updateStaffStatus);
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "active" | "invited" | "disabled" }) => setStatusFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-admin"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = (q.data?.staff ?? []) as any[];

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> User admin</CardTitle>
        <CardDescription>Staff accounts across the workspace — enable, disable, or review roles.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState icon={UserCog} title="No staff yet" description="Invite team members from the Staff page." /></div>
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
                <span className="text-sm capitalize">{String(s.role).replace(/_/g, " ")}</span>
                <Badge variant={s.status === "active" ? "success" : s.status === "disabled" ? "outline" : "secondary"} className="w-fit capitalize">
                  {s.status}
                </Badge>
                <div className="flex justify-end gap-1">
                  {s.status !== "disabled" ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "disabled" })}>
                      <ShieldOff className="mr-1 h-3.5 w-3.5" /> Disable
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "active" })}>
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Enable
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
