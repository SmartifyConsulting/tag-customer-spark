import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500 text-white",
  scheduled: "bg-blue-600 text-white",
  sending: "bg-amber-500 text-white",
  sent: "bg-emerald-600 text-white",
  completed: "bg-emerald-600 text-white",
  cancelled: "bg-rose-600 text-white",
};

const TYPE_COLORS: Record<string, string> = {
  sale: "bg-fuchsia-600 text-white",
  low_stock: "bg-amber-500 text-white",
  back_in_stock: "bg-teal-500 text-white",
  promotion: "bg-indigo-600 text-white",
  custom: "bg-slate-600 text-white",
};

const TYPE_LABELS: Record<string, string> = {
  sale: "Sale",
  low_stock: "Low stock",
  back_in_stock: "Back in stock",
  promotion: "Promotion",
  custom: "Custom",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn("border-transparent shadow-sm", STATUS_COLORS[status] ?? "bg-slate-500 text-white", className)}>
      {status}
    </Badge>
  );
}

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  return (
    <Badge className={cn("border-transparent shadow-sm", TYPE_COLORS[type] ?? "bg-slate-600 text-white", className)}>
      {TYPE_LABELS[type] ?? type}
    </Badge>
  );
}
