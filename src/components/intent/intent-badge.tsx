import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type IntentTrend = "rising" | "falling" | "stable";

export function intentColor(score: number) {
  if (score >= 70) return "success";
  if (score >= 40) return "amber";
  return "rose";
}

const COLOR_CLASS: Record<string, string> = {
  success: "bg-success/10 text-success border-success/30",
  amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
};


export function IntentBadge({
  score,
  trend = "stable",
  confidence,
  size = "md",
  className,
}: {
  score: number | null | undefined;
  trend?: IntentTrend;
  confidence?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const s = Math.round(Number(score ?? 50));
  const color = intentColor(s);
  const TrendIcon = trend === "rising" ? TrendingUp : trend === "falling" ? TrendingDown : Minus;
  const low = (confidence ?? 0) < 0.2;
  const sizes = {
    sm: "text-[11px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2 font-semibold",
  }[size];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium tabular-nums",
        COLOR_CLASS[color],
        sizes,
        className,
      )}
      title={low ? "Low confidence score" : `Intent score ${s}/100 (${trend})`}
    >
      <span>{s}</span>
      <TrendIcon className="h-3 w-3" />
      {low && size !== "sm" && <span className="opacity-70">·low</span>}
    </span>
  );
}
