import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Loader2, MailCheck, MousePointerClick, RefreshCw, Send, Ticket } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { AUTOMATION_BY_KEY, type AutomationKey } from "@/lib/automation";
import { listNotificationLogs, refreshDeliveryStatuses } from "@/lib/automation.functions";

const PAGE_SIZE = 50;

type LogStatus = "all" | "queued" | "sent" | "delivered" | "read" | "clicked" | "redeemed" | "failed";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success"; icon: typeof Send }
> = {
  // Infobip accepted the send; no delivery report has come back yet. It may well
  // have been delivered — "Refresh delivery status" asks Infobip directly.
  queued: { label: "Awaiting report", variant: "outline", icon: Clock },
  sent: { label: "Sent", variant: "secondary", icon: Send },
  // delivered/read/clicked/redeemed are all "the message actually landed"
  // outcomes, each stronger than the last — green throughout so they read
  // as one family, rather than delivered being green while a stronger
  // signal like read/clicked sits in the primary brand colour (which
  // reads as neutral-to-alarming next to a green badge, not "better").
  delivered: { label: "Delivered", variant: "success", icon: MailCheck },
  read: { label: "Read", variant: "success", icon: CheckCircle2 },
  clicked: { label: "Clicked", variant: "success", icon: MousePointerClick },
  redeemed: { label: "Redeemed", variant: "success", icon: Ticket },
  failed: { label: "Failed", variant: "destructive", icon: AlertTriangle },
};

function ruleLabel(rule: string | null): string {
  if (!rule) return "—";
  const known = AUTOMATION_BY_KEY[rule as AutomationKey];
  return known?.label ?? rule;
}

// "Queued" only means Infobip's API accepted the send — it's promoted to
// sent/delivered/read by a later delivery-report webhook call, which can
// take a few minutes to arrive. Past that, a row that's still queued
// either went to a number that was never real (seed/demo data — Infobip
// can never produce a delivery report for those) or the webhook call
// genuinely never reached this app. Nothing in server logs surfaces that
// distinction to a non-technical reader, so flag it here instead.
const STUCK_QUEUED_MINUTES = 10;
function isStuckQueued(status: string, createdAt: string): boolean {
  if (status !== "queued") return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs > STUCK_QUEUED_MINUTES * 60_000;
}

export function AutomationLogsTab() {
  const [status, setStatus] = useState<LogStatus>("all");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const refreshFn = useServerFn(refreshDeliveryStatuses);
  const [refreshing, setRefreshing] = useState(false);

  const logs = useQuery({
    queryKey: ["automation-logs", status, page],
    queryFn: () => listNotificationLogs({ data: { status, page, pageSize: PAGE_SIZE } }),
  });

  const rows = logs.data?.rows ?? [];
  const total = logs.data?.total ?? 0;

  // Ask Infobip about sends still waiting for a report. Delivery reports
  // normally arrive by themselves; when they don't, this fills the gap.
  async function refreshStatuses(manual: boolean) {
    setRefreshing(true);
    try {
      const r = await refreshFn();
      if (r.updated > 0) await qc.invalidateQueries({ queryKey: ["automation-logs"] });
      if (!manual) return;
      if (r.checked === 0) {
        toast.info("Nothing is waiting for a delivery report.");
        return;
      }
      const parts: string[] = [];
      if (r.delivered > 0) parts.push(`${r.delivered} delivered`);
      if (r.failed > 0) parts.push(`${r.failed} failed`);
      const headline = r.updated > 0 ? `Updated ${r.updated} send${r.updated === 1 ? "" : "s"} from Infobip (${parts.join(", ")}).` : "No statuses changed.";
      const notes: string[] = [];
      if (r.notFound > 0)
        notes.push(`${r.notFound} couldn't be found at Infobip, usually because they're older than Infobip keeps its logs.`);
      if (r.stillPending > 0) notes.push(`${r.stillPending} still pending at Infobip.`);
      toast.success(headline, notes.length ? { description: notes.join(" ") } : undefined);
    } catch (e: any) {
      if (manual) toast.error(e?.message ?? "Couldn't check delivery status with Infobip");
    } finally {
      setRefreshing(false);
    }
  }

  // Once per visit, and only when something is actually waiting.
  const autoRefreshed = useRef(false);
  useEffect(() => {
    if (autoRefreshed.current || logs.isLoading) return;
    if (!rows.some((r) => r.status === "queued")) return;
    autoRefreshed.current = true;
    void refreshStatuses(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.isLoading, rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every WhatsApp send attempt for this workspace, most recent first — with the reason for
          any failure.
        </p>
        <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshStatuses(true)}
          disabled={refreshing}
          title="Ask Infobip for the delivery status of sends still awaiting a report"
        >
          {refreshing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh delivery status
        </Button>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as LogStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="clicked">Clicked</SelectItem>
            <SelectItem value="redeemed">Redeemed</SelectItem>
            <SelectItem value="queued">Awaiting report</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      <div className="rounded-lg border">
        {logs.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading logs…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Send}
              title="No sends yet"
              description={
                status === "all"
                  ? "WhatsApp sends will appear here as automations trigger."
                  : `No sends currently in "${STATUS_META[status]?.label ?? status}" status.`
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Automation</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status] ?? { label: r.status, variant: "outline" as const, icon: Send };
                  const Icon = meta.icon;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.customer_name || "Unnamed"}</div>
                        <div className="text-xs text-muted-foreground">{r.customer_phone || "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">{ruleLabel(r.rule)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.template ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="gap-1">
                          <Icon className="h-3 w-3" /> {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-destructive">
                        {r.error ??
                          (isStuckQueued(r.status, r.created_at) ? (
                            <span
                              className="flex items-center gap-1 text-muted-foreground"
                              title="Infobip accepted this send, but no delivery report has reached Tag after 10+ minutes. It may still have been delivered — press Refresh delivery status to ask Infobip directly."
                            >
                              <AlertTriangle className="h-3 w-3" /> No delivery report yet
                            </span>
                          ) : (
                            ""
                          ))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {Math.ceil(total / PAGE_SIZE)} · {total} sends
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
