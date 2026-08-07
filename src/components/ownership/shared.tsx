import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function warrantyState(expiresOn?: string | null) {
  if (!expiresOn) return { label: "No warranty", tone: "muted" as const, daysLeft: null };
  const days = daysBetween(new Date(), new Date(expiresOn));
  if (days < 0) return { label: "Expired", tone: "expired" as const, daysLeft: days };
  if (days <= 60) return { label: `${days} days left`, tone: "soon" as const, daysLeft: days };
  return { label: `${days} days left`, tone: "ok" as const, daysLeft: days };
}

export function StatusBadge({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "soon" | "expired" | "muted" | "info";
  children: ReactNode;
}) {
  const cls: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
    soon: "bg-amber-100 text-amber-900 border-amber-200",
    expired: "bg-rose-100 text-rose-800 border-rose-200",
    info: "bg-sky-100 text-sky-800 border-sky-200",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", cls[tone])}>
      {children}
    </Badge>
  );
}

export function WarrantyProgress({
  startsOn,
  expiresOn,
  className,
}: {
  startsOn?: string | null;
  expiresOn?: string | null;
  className?: string;
}) {
  if (!expiresOn) return null;
  const start = startsOn ? new Date(startsOn).getTime() : Date.now();
  const end = new Date(expiresOn).getTime();
  const now = Date.now();
  const pct = Math.max(0, Math.min(100, ((now - start) / Math.max(1, end - start)) * 100));
  const state = warrantyState(expiresOn);
  const bar =
    state.tone === "expired" ? "bg-rose-500" : state.tone === "soon" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Warranty {state.tone === "expired" ? "expired" : "ends"}{" "}
        {new Date(expiresOn).toLocaleDateString()}
      </p>
    </div>
  );
}

export type TimelineStep = {
  label: string;
  date?: string | null;
  done?: boolean;
  detail?: string;
};

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span
            className={cn(
              "absolute -left-[1.6875rem] top-1 h-3 w-3 rounded-full border-2",
              s.done ? "border-foreground bg-foreground" : "border-border bg-background",
            )}
          />
          <p className="text-sm font-medium">{s.label}</p>
          {s.date && (
            <p className="text-xs text-muted-foreground">
              {new Date(s.date).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
          {s.detail && <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

// Code 39 — small enough to render inline, no extra dependency, and every
// retail scanner reads it. The TAG ID alphabet (A-Z, 0-9, dash) fits exactly.
const CODE39: Record<string, string> = {
  "0": "101001101101", "1": "110100101011", "2": "101100101011", "3": "110110010101",
  "4": "101001101011", "5": "110100110101", "6": "101100110101", "7": "101001011011",
  "8": "110100101101", "9": "101100101101", A: "110101001011", B: "101101001011",
  C: "110110100101", D: "101011001011", E: "110101100101", F: "101101100101",
  G: "101010011011", H: "110101001101", I: "101101001101", J: "101011001101",
  K: "110101010011", L: "101101010011", M: "110110101001", N: "101011010011",
  O: "110101101001", P: "101101101001", Q: "101010110011", R: "110101011001",
  S: "101101011001", T: "101011011001", U: "110010101011", V: "100110101011",
  W: "110011010101", X: "100101101011", Y: "110010110101", Z: "100110110101",
  "-": "100101011011", ".": "110010101101", " ": "100110101101", "*": "100101101101",
};

export function Barcode({ value, height = 64 }: { value: string; height?: number }) {
  const chars = `*${value.toUpperCase()}*`.split("");
  const bits: string[] = [];
  for (const c of chars) {
    bits.push(CODE39[c] ?? CODE39["-"]!);
    bits.push("0");
  }
  const pattern = bits.join("");
  const width = pattern.length * 2;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Barcode for ${value}`}
    >
      <rect width={width} height={height} fill="#ffffff" />
      {pattern.split("").map((bit, i) =>
        bit === "1" ? <rect key={i} x={i * 2} y={0} width={2} height={height} fill="#0A1F5C" /> : null,
      )}
    </svg>
  );
}

// Receipt lifecycle state. Issuing states are stored on the receipt; the
// returned / refunded / warranty-registered states are derived server-side.
const RECEIPT_STATUS: Record<string, { label: string; tone: "ok" | "soon" | "expired" | "muted" | "info" }> = {
  paper: { label: "Paper", tone: "muted" },
  digital: { label: "Digital", tone: "ok" },
  synced: { label: "Synced", tone: "ok" },
  pending: { label: "Pending", tone: "soon" },
  failed: { label: "Failed", tone: "expired" },
  returned: { label: "Returned", tone: "soon" },
  refunded: { label: "Refunded", tone: "expired" },
  warranty_registered: { label: "Warranty registered", tone: "info" },
};

export function ReceiptStatusBadge({ status }: { status?: string | null }) {
  const s = RECEIPT_STATUS[status ?? "digital"] ?? RECEIPT_STATUS["digital"]!;
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}
