import { useQuery } from "@tanstack/react-query";
import { getInventoryNotificationCounts } from "@/lib/dashboard.functions";

const items = [
  { key: "queued", label: "Queued", color: "bg-muted-foreground" },
  { key: "sent", label: "Sent", color: "bg-sky-500" },
  { key: "read", label: "Read", color: "bg-amber-500" },
  { key: "clicked", label: "Clicked", color: "bg-orange-500" },
] as const;

export function NotificationCountsStrip() {
  const { data } = useQuery({
    queryKey: ["inventory", "notification-counts"],
    queryFn: () => getInventoryNotificationCounts(),
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-wrap items-start gap-6 rounded-2xl border border-border bg-card px-5 py-4">
      {items.map((it) => (
        <div key={it.key} className="flex flex-col items-center gap-1 min-w-[64px]">
          <div className={`h-1.5 w-14 rounded-full ${it.color}`} />
          <div className="text-2xl font-semibold tabular-nums text-foreground">
            {data ? (data as any)[it.key] ?? 0 : 0}
          </div>
          <div className="text-xs text-muted-foreground">{it.label}</div>
        </div>
      ))}
    </div>
  );
}
