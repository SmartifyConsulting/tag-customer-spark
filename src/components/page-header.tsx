import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border-l-4 border-primary bg-gradient-to-r from-primary/10 via-secondary/10 to-transparent p-4 pb-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:p-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
