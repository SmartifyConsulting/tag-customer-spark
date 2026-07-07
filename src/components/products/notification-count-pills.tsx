import type { ProductNotificationCounts } from "@/lib/dashboard.functions";

const items = [
  { key: "queued", label: "Queued", color: "bg-muted-foreground" },
  { key: "sent", label: "Sent", color: "bg-sky-500" },
  { key: "read", label: "Read", color: "bg-amber-500" },
  { key: "clicked", label: "Clicked", color: "bg-orange-500" },
] as const;

export function NotificationCountPills({
  counts,
  size = "sm",
}: {
  counts?: ProductNotificationCounts;
  size?: "sm" | "xs";
}) {
  const c = counts ?? { queued: 0, sent: 0, read: 0, clicked: 0 };
  const pad = size === "xs" ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const text = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((it) => (
        <span
          key={it.key}
          className={`inline-flex items-center gap-1 rounded-full border border-border bg-background ${pad} ${text} tabular-nums text-foreground`}
          title={it.label}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${it.color}`} />
          <span className="font-semibold">{(c as any)[it.key] ?? 0}</span>
          <span className="text-muted-foreground">{it.label}</span>
        </span>
      ))}
    </div>
  );
}
