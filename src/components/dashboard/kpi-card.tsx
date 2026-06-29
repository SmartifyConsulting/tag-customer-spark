import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCountUp } from "@/hooks/use-count-up";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export type KpiTone = "default" | "success" | "warning";

export function KpiCard({
  label,
  value,
  formatted,
  delta,
  deltaLabel,
  icon: Icon,
  tone = "default",
  sparkline,
  index = 0,
}: {
  label: string;
  value: number;
  formatted?: string;
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  sparkline?: { v: number }[];
  index?: number;
}) {
  const animated = useCountUp(value);
  const display = formatted ?? Math.round(animated).toLocaleString();
  const positive = (delta ?? 0) >= 0;
  const toneRing =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";
  const sparkColor =
    tone === "success"
      ? "var(--success)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--primary)";

  return (
    <Card
      className="group relative overflow-hidden rounded-2xl border-border/60 transition-shadow duration-300 hover:shadow-lg animate-fade-in"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
    >
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneRing}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
            {display}
          </p>
          {typeof delta === "number" && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                positive
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta)}
              {deltaLabel ? ` ${deltaLabel}` : ""}
            </span>
          )}
        </div>
        <div className="h-10">
          {sparkline && sparkline.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`kpi-grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={2}
                  fill={`url(#kpi-grad-${label})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
