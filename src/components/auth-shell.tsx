import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing-page";
import heroImage from "@/assets/auth-hero-surf.png.asset.json";

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
    <div className="min-h-screen bg-background px-4 py-6 lg:px-10">
      <MarketingHeader right={null} />

      <div className="mx-auto grid max-w-6xl items-start gap-10 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        {/* Hero column — beach/scan energy */}
        <div className="hidden lg:block">
          <div className="relative overflow-hidden rounded-[2rem] shadow-elevated">
            <img
              src={heroImage.url}
              alt="Shopper scanning a Tag barcode on a surfboard in a beach store"
              className="h-[26rem] w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7">
              <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                Scan. Follow. Engage.
              </span>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
                Your customers are interested—your products just don't know it yet.
              </h1>
            </div>
          </div>

          <p className="mt-6 w-full text-justify text-base text-muted-foreground">
            You know exactly what sold. You don't know what almost did. Tag brings{" "}
            <span className="font-bold text-foreground">Retail Intelligence</span> to physical
            stores — capturing buying intent and reconnecting with shoppers after they leave.
          </p>
          <p className="mt-3 text-base font-bold text-[#DF2F2F]">No more blind spots.</p>
        </div>

        {/* Form column */}
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* Compact hero banner on small screens */}
          <div className="relative overflow-hidden rounded-2xl lg:hidden">
            <img
              src={heroImage.url}
              alt="Shopper scanning a Tag barcode on a surfboard in a beach store"
              className="h-36 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent" />
            <span className="absolute bottom-3 left-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
              Scan. Follow. Engage.
            </span>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
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
