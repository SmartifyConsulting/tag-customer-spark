import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Activity, QrCode, UserPlus, Send, BadgeCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const META: Record<string, { icon: LucideIcon; tone: string }> = {
  scan: { icon: QrCode, tone: "bg-primary/10 text-primary" },
  opt_in: { icon: UserPlus, tone: "bg-success/10 text-success" },
  notification: { icon: Send, tone: "bg-warning/10 text-warning" },
  recovery: { icon: BadgeCheck, tone: "bg-success/10 text-success" },
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function RecentActivityCard({
  items,
}: {
  items: { id: string; type: string; at: string; label: string; sublabel: string | null }[];
}) {
  return (
    <Card className="rounded-2xl animate-fade-in" style={{ animationDelay: "480ms", animationFillMode: "backwards" }}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent customer activity</CardTitle>
        <p className="text-xs text-muted-foreground">Latest scans, opt-ins, notifications and recoveries</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={Activity} title="Nothing here yet" description="Customer activity will start streaming in once your store is live." />
        ) : (
          <ol className="relative space-y-2">
            {items.map((it, i) => {
              const meta = META[it.type] ?? META.scan;
              const Icon = meta.icon;
              return (
                <li
                  key={it.id}
                  className="flex items-start gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent/40 animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
                >
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{it.label}</p>
                    {it.sublabel && (
                      <p className="truncate text-xs text-muted-foreground">{it.sublabel}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(it.at)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
