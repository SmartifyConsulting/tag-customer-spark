import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Copy, MoreHorizontal, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import {
  listCampaigns,
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
} from "@/lib/notifications.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/notifications/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/notifications/")({
  head: () => ({ meta: [{ title: "Notifications — Tag" }] }),
  component: NotificationsList,
});

function NotificationsList() {
  const [status, setStatus] = useState<"all" | "draft" | "scheduled" | "sending" | "completed" | "cancelled">("all");
  const list = useServerFn(listCampaigns);
  const cancelFn = useServerFn(cancelCampaign);
  const deleteFn = useServerFn(deleteCampaign);
  const dupFn = useServerFn(duplicateCampaign);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", status],
    queryFn: () => list({ data: { status } }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign cancelled");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign duplicated");
      navigate({ to: "/notifications/$campaignId", params: { campaignId: r.id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });


  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Compose, schedule, and track WhatsApp campaigns."
        actions={
          <Button asChild>
            <Link to="/notifications/new">
              <Plus className="mr-2 h-4 w-4" /> New campaign
            </Link>
          </Button>
        }
      />

      <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sending">Sending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No campaigns yet"
          description="Build your first WhatsApp campaign — sale, low stock, restock, promo, or anything custom."
          action={
            <Button asChild>
              <Link to="/notifications/new"><Plus className="mr-2 h-4 w-4" />New campaign</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {data.map((c: any) => {
            const funnel = c.funnel ?? {};
            const canCancel = c.status === "draft" || c.status === "scheduled" || c.status === "sending";
            const canDelete = c.status === "draft" || c.status === "cancelled";
            return (
              <Card key={c.id} className="p-4 border-border/70 hover:border-foreground/30 transition-colors">
                <div className="flex items-start gap-4">
                  <Link
                    to="/notifications/$campaignId"
                    params={{ campaignId: c.id }}
                    className="flex flex-1 items-start gap-4 min-w-0"
                  >
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-muted grid place-items-center">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{c.title}</span>
                        <TypeBadge type={c.type} />
                        <StatusBadge status={c.status} />
                      </div>
                      {c.headline && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{c.headline}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Audience: <span className="font-medium text-foreground">{c.audience_size ?? 0}</span></span>
                        {c.scheduled_at && (
                          <span>Scheduled: {new Date(c.scheduled_at).toLocaleString()}</span>
                        )}
                        {c.sent_at && <span>Sent: {new Date(c.sent_at).toLocaleString()}</span>}
                      </div>
                    </div>
                  </Link>
                  <FunnelMini funnel={funnel} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(c.status === "draft" || c.status === "scheduled") && (
                        <DropdownMenuItem asChild>
                          <Link to="/notifications/$campaignId/edit" params={{ campaignId: c.id }}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => duplicate.mutate(c.id)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      {canCancel && (
                        <DropdownMenuItem onClick={() => cancel.mutate(c.id)}>
                          <XCircle className="mr-2 h-4 w-4" /> Cancel
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete campaign "${c.title}"? This cannot be undone.`)) {
                              remove.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FunnelMini({ funnel }: { funnel: any }) {
  const items = [
    ["Queued", funnel.queued ?? 0, "bg-muted-foreground/50"],
    ["Sent", funnel.sent ?? 0, "bg-blue-400"],
    ["Read", funnel.read ?? 0, "bg-[color:var(--success)]"],
    ["Clicked", funnel.clicked ?? 0, "bg-[color:var(--warning)]"],
  ] as const;
  return (
    <div className="hidden sm:grid grid-cols-4 gap-2 text-center">
      {items.map(([label, value, color]) => (
        <div key={label} className="min-w-[44px]">
          <div className={`h-1.5 rounded-full ${color}`} />
          <div className="mt-1 text-xs font-semibold tabular-nums">{value as number}</div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  );
}
