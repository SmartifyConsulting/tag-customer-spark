import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "default",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
  size?: "default" | "lg";
}) {
  const isLg = size === "lg";
  return (
    <div
      className={
        "relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-border bg-gradient-to-b from-card to-muted/30 text-center shadow-[var(--shadow-card)] " +
        (isLg ? "px-8 py-16 " : "px-6 py-12 ") +
        (className ?? "")
      }
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[color:var(--mint)]/8 blur-3xl" />
        <div className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div
        className={
          "relative grid place-items-center rounded-2xl bg-card text-[color:var(--mint)] shadow-sm ring-1 ring-border " +
          (isLg ? "h-16 w-16" : "h-12 w-12")
        }
      >
        <Icon className={isLg ? "h-7 w-7" : "h-5 w-5"} />
      </div>
      <p
        className={
          "relative font-semibold text-foreground " +
          (isLg ? "text-lg" : "text-sm")
        }
      >
        {title}
      </p>
      {description && (
        <p
          className={
            "relative max-w-sm text-muted-foreground " +
            (isLg ? "text-sm" : "text-xs")
          }
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="relative mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
