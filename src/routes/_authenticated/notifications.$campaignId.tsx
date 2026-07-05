import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Bell, CheckCheck, Copy, Eye, MousePointerClick, Pencil, Send, Sparkles, Trash2 } from "lucide-react";
import {
  getCampaign,
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
} from "@/lib/notifications.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/notifications/status-badge";
import { WhatsAppPreview } from "@/components/notifications/whatsapp-preview";

export const Route = createFileRoute("/_authenticated/notifications/$campaignId")({
  head: () => ({ meta: [{ title: "Campaign — Tag" }] }),
  component: CampaignDetail,
});

const FUNNEL = [
  { key: "queued", label: "Queued", icon: Bell },
  { key: "sent", label: "Sent", icon: Send },
  { key: "delivered", label: "Delivered", icon: CheckCheck },
  { key: "read", label: "Read", icon: Eye },
  { key: "clicked", label: "Clicked", icon: MousePointerClick },
  { key: "redeemed", label: "Redeemed", icon: Sparkles },
] as const;

function CampaignDetail() {
  const { campaignId } = useParams({ from: "/_authenticated/notifications/$campaignId" });
  const navigate = useNavigate();
  const getFn = useServerFn(getCampaign);
  const cancelFn = useServerFn(cancelCampaign);
  const deleteFn = useServerFn(deleteCampaign);
  const dupFn = useServerFn(duplicateCampaign);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getFn({ data: { id: campaignId } }),
    refetchInterval: 5000,
  });

  const duplicate = useMutation({
    mutationFn: () => dupFn({ data: { id: campaignId } }),
    onSuccess: (r) => {
      toast.success("Duplicated");
      navigate({ to: "/notifications/$campaignId", params: { campaignId: r.id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: campaignId } }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      navigate({ to: "/notifications" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }
  const c = data.campaign;
  const f = data.funnel;
  const total = data.total || 1;

  const canDelete = c.status === "draft" || c.status === "cancelled";
  const canCancel = c.status === "draft" || c.status === "scheduled" || c.status === "sending";

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.title}
        description={c.headline ?? "Campaign details and delivery funnel."}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/notifications"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link></Button>
            {c.status === "draft" && (
              <Button asChild variant="outline" size="sm">
                <Link to="/notifications/$campaignId/edit" params={{ campaignId: c.id }}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              <Copy className="mr-1 h-4 w-4" /> Duplicate
            </Button>
            {canCancel && (
              <Button variant="destructive" size="sm" onClick={async () => { await cancelFn({ data: { id: c.id } }); refetch(); }}>
                Cancel
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete campaign "${c.title}"? This cannot be undone.`)) remove.mutate();
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        }
      />


      <div className="flex flex-wrap gap-2 items-center">
        <TypeBadge type={c.type} />
        <StatusBadge status={c.status} />
        {c.scheduled_at && <span className="text-xs text-muted-foreground">Scheduled {new Date(c.scheduled_at).toLocaleString()}</span>}
        {c.sent_at && <span className="text-xs text-muted-foreground">Sent {new Date(c.sent_at).toLocaleString()}</span>}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Delivery funnel</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {FUNNEL.map(({ key, label, icon: Icon }) => {
                const value = (f as any)[key] ?? 0;
                const pct = Math.round((value / total) * 100);
                return (
                  <div key={key} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs"><Icon className="h-3.5 w-3.5" />{label}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
                    <div className="text-[11px] text-muted-foreground">{pct}%</div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 space-y-2 text-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Campaign content</h3>
            <Row label="Headline" value={c.headline} />
            <Row label="Body" value={c.body} />
            <Row label="CTA" value={c.cta_label ? `${c.cta_label} → ${c.cta_url ?? "—"}` : "—"} />
            <Row label="Redemption code" value={c.redemption_code ?? "—"} />
            <Row label="Expires" value={c.expires_at ? new Date(c.expires_at).toLocaleString() : "—"} />
            <Row label="Audience" value={`${c.audience_size ?? 0} customers`} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">WhatsApp preview</p>
          <WhatsAppPreview
            imageUrl={c.image_url}
            headline={c.headline}
            body={c.body}
            ctaLabel={c.cta_label}
            expiresAt={c.expires_at}
            redemptionCode={c.redemption_code}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="text-foreground whitespace-pre-wrap break-words">{value || "—"}</span>
    </div>
  );
}
