import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ownership/shared";
import { lifecycleAlerts } from "@/lib/ownership.functions";

/** Receipt received, warranty expiring, return window ending, price drop, recall. */
export function LifecycleAlerts() {
  const fn = useServerFn(lifecycleAlerts);
  const { data } = useQuery({
    queryKey: ["ownership", "lifecycle-alerts"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });

  const alerts = (data ?? []) as any[];
  if (!alerts.length) return null;

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4" /> Lifecycle alerts
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <StatusBadge tone={a.tone}>{a.kind}</StatusBadge>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
