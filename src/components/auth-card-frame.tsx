import type { ReactNode } from "react";

// The bordered card + title/subtitle header shared by AuthShell's sign-in
// card and the inline "Create your Tag account" modal on the hero page —
// kept separate so both can use identical chrome without one importing
// the other's page-specific layout.
export function AuthCardFrame({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8 ${className ?? ""}`}>
      <div className="mb-6 space-y-1 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
