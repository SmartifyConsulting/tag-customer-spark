import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import heroLogo from "@/assets/tag-logo-hero.png.asset.json";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={heroLogo.url} alt="Tag" className="h-48 w-auto object-contain" />
        </div>
        <Card className="rounded-2xl border-border/60 p-6 sm:p-8 shadow-sm">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </Card>
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
