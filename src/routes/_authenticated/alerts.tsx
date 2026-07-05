import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Inbox as InboxIcon, MessageSquare, Plus, Sparkles, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listConversations } from "@/lib/inbox.functions";
import { listCampaigns } from "@/lib/notifications.functions";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — Tag" }] }),
  component: AlertsPage,
});

function fmt(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function AlertsPage() {
  const listConv = useServerFn(listConversations);
  const listCamp = useServerFn(listCampaigns);

  const convs = useQuery({
    queryKey: ["conversations", "alerts"],
    queryFn: () => listConv({ data: { scope: "all" } }),
  });
  const camps = useQuery({
    queryKey: ["campaigns", "alerts"],
    queryFn: () => listCamp({ data: { status: "all" } }),
  });

  const unread = (convs.data ?? []).reduce(
    (s: number, c: any) => s + (c.unread_count ?? 0),
    0,
  );
  const liveCampaigns = (camps.data ?? []).filter((c: any) =>
    ["scheduled", "sending", "sent"].includes(c.status),
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alerts"
        description="Every inbound conversation and outbound campaign — one operational stream."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/inbox">
                <InboxIcon className="mr-2 h-4 w-4" /> Open full inbox
              </Link>
            </Button>
            <Button asChild>
              <Link to="/notifications/new">
                <Plus className="mr-2 h-4 w-4" /> New campaign
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unread conversations" value={unread} icon={MessageSquare} tone="mint" />
        <StatCard label="Live campaigns" value={liveCampaigns} icon={Bell} tone="navy" />
        <StatCard label="Open threads" value={(convs.data ?? []).length} icon={Sparkles} tone="muted" />
      </div>


      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">
            <InboxIcon className="mr-2 h-3.5 w-3.5" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Bell className="mr-2 h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3">
          <Card className="rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Recent conversations</CardTitle>
                <CardDescription>Customer replies streamed in real time.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/inbox">
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {convs.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
              ) : !convs.data?.length ? (
                <EmptyState
                  icon={InboxIcon}
                  title="No conversations yet"
                  description="Customer replies will appear here."
                />
              ) : (
                convs.data.slice(0, 8).map((c: any) => (
                  <Link
                    key={c.id}
                    to="/inbox"
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {c.customer?.full_name ?? c.customer?.whatsapp_e164 ?? "Customer"}
                        </span>
                        {c.unread_count > 0 && (
                          <Badge className="h-4 min-w-4 bg-[color:var(--mint)] px-1 text-[10px] text-[color:var(--mint-foreground)]">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.subject ?? "New conversation"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(c.last_message_at)}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-3">
          <Card className="rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Recent campaigns</CardTitle>
                <CardDescription>WhatsApp + email notification activity.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/notifications">
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {camps.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
              ) : !camps.data?.length ? (
                <EmptyState icon={Bell} title="No campaigns yet" />
              ) : (
                camps.data.slice(0, 8).map((c: any) => (
                  <Link
                    key={c.id}
                    to="/notifications/$campaignId"
                    params={{ campaignId: c.id }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.title}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{c.type}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.headline ?? "—"}
                      </p>
                    </div>
                    <Badge className="shrink-0 capitalize" variant="outline">{c.status}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "mint" | "navy" | "amber";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[color:var(--mint)]/10 text-[color:var(--mint)]"
      : tone === "amber"
        ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
        : "bg-primary/10 text-primary";
  return (
    <Card className="rounded-xl shadow-[var(--shadow-card)]">
      <CardContent className="flex items-start gap-3 p-5">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
