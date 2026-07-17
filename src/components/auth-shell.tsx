import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing-nav";
import heroLogo from "@/assets/tag-logo-clear.png.asset.json";

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
    <div className="min-h-screen bg-white px-4 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-end py-4">
        <MarketingNav />
      </div>
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1fr]">
        {/* Hero panel — hidden on small screens to keep the form the focus */}
        <div className="hidden lg:block">
          <img src={heroLogo.url} alt="Tag" className="h-48 w-auto object-contain" />
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-foreground xl:text-5xl">
            Your customers are interested.
            <br />
            <span className="text-primary">Your products just don't know it yet.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            Tag transforms ordinary products into intelligent digital touchpoints that capture
            customer interest, reveal buying intent, and reconnect shoppers after they leave the
            store — turning missed opportunities into measurable revenue.
          </p>
        </div>

        {/* Form column */}
        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="flex justify-center lg:hidden">
            <img src={heroLogo.url} alt="Tag" className="h-32 w-auto object-contain" />
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 space-y-1 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
