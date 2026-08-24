import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Loader2, MailCheck, MousePointerClick, Send, Ticket } from "lucide-react";
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
import { listNotificationLogs } from "@/lib/automation.functions";

const PAGE_SIZE = 50;

type LogStatus = "all" | "queued" | "sent" | "delivered" | "read" | "clicked" | "redeemed" | "failed";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Send }
> = {
  queued: { label: "Queued", variant: "outline", icon: Clock },
  sent: { label: "Sent", variant: "secondary", icon: Send },
  delivered: { label: "Delivered", variant: "secondary", icon: MailCheck },
  read: { label: "Read", variant: "default", icon: CheckCircle2 },
  clicked: { label: "Clicked", variant: "default", icon: MousePointerClick },
  redeemed: { label: "Redeemed", variant: "default", icon: Ticket },
  failed: { label: "Failed", variant: "destructive", icon: AlertTriangle },
};

function ruleLabel(rule: string | null): string {
  if (!rule) return "—";
  const known = AUTOMATION_BY_KEY[rule as AutomationKey];
  return known?.label ?? rule;
}

export function AutomationLogsTab() {
  const [status, setStatus] = useState<LogStatus>("all");
  const [page, setPage] = useState(1);

  const logs = useQuery({
    queryKey: ["automation-logs", status, page],
    queryFn: () => listNotificationLogs({ data: { status, page, pageSize: PAGE_SIZE } }),
  });

  const rows = logs.data?.rows ?? [];
  const total = logs.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every WhatsApp send attempt for this workspace, most recent first — with the reason for
          any failure.
        </p>
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
            <SelectItem value="queued">Queued</SelectItem>
          </SelectContent>
        </Select>
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
                        {r.error ?? ""}
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
