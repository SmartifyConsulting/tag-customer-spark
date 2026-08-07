import { Leaf } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import { formatKg } from "@/lib/sustainability";

// The live impact strip. Every number counts up on mount and ticks again
// whenever fresh data arrives, so sustainability reads as something
// happening now rather than a monthly report.
function Metric({ label, value, formatted }: { label: string; value: number; formatted?: string }) {
  const animated = useCountUp(value, 1200);
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-50/80">{label}</p>
      <p className="truncate text-2xl font-bold tabular-nums text-white sm:text-3xl">
        {formatted ?? Math.round(animated).toLocaleString()}
      </p>
    </div>
  );
}

export function LiveImpactBanner({
  digitalReceipts,
  paperAvoided,
  thermalPaperKg,
  since,
}: {
  digitalReceipts: number;
  paperAvoided: number;
  thermalPaperKg: number;
  since: string;
}) {
  const kg = useCountUp(thermalPaperKg, 1200);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-5 shadow-lg">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="mr-auto">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Leaf className="h-4 w-4" /> Live Impact
          </p>
          <p className="text-[11px] text-emerald-50/80">
            Since joining TAG · {new Date(since).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <Metric label="Digital receipts issued" value={digitalReceipts} />
        <Metric label="Paper receipts avoided" value={paperAvoided} />
        <Metric label="Thermal paper saved" value={thermalPaperKg} formatted={formatKg(kg)} />
      </div>
    </div>
  );
}
