import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing-nav";
import { TagLogo } from "@/components/tag-logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header with top-left logo and nav */}
      <header className="border-b border-border/20 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-7xl items-center gap-6">
          <Link to="/about" className="shrink-0">
            <TagLogo variant="wordmark" size="sm" className="h-[4.8rem]" />
          </Link>
          <MarketingNav showStartSetup />
        </div>
      </header>

      {/* Main content - centered form */}
      <main className="flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 space-y-1 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
