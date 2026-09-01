import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing-nav";
import heroImage from "@/assets/auth-hero-surf-scan.png.asset.json";

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
    <div className="min-h-screen bg-background px-4 py-5 lg:px-10">
      {/* Header row: nav's left edge matches the hero image's left edge
          (same grid column, no extra centering). The top-right logo that
          used to balance this row has been removed, so this is now just
          the nav pinned to a much smaller top offset. */}
      <div className="mx-auto max-w-6xl pt-4 lg:pt-6">
        <div className="hidden lg:block">
          <MarketingNav />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl items-start gap-10 pt-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Hero column — beach/scan energy. Top-aligned with the "Welcome
            back" card via the shared items-start on this grid. */}
        <div className="hidden lg:block">
          <div className="relative overflow-hidden rounded-[2rem] shadow-elevated">
            <img
              src={heroImage.url}
              alt="Shopper scanning a Tag barcode sticker on a surfboard in a beach surf shop"
              className="h-[20.8rem] w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/12 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7">
              <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                Scan. Follow. Engage.
              </span>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-primary xl:text-4xl">
                Your customers may be interested—you just don't know it yet.
              </h1>
            </div>
          </div>

          <p className="mt-5 w-full text-justify text-base text-muted-foreground">
            You know exactly what sold. You don't know what almost did. Tag brings{" "}
            <span className="font-bold text-foreground">Retail Intelligence</span> to physical
            stores — capturing buying interest and reconnecting with shoppers over WhatsApp after
            they leave.
          </p>
          <p className="mt-2 text-base font-bold text-[#F2A93B]">Fewer blind spots.</p>
        </div>

        {/* Form column */}
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* Compact hero banner on small screens */}
          <div className="relative overflow-hidden rounded-2xl lg:hidden">
            <img
              src={heroImage.url}
              alt="Shopper scanning a Tag barcode sticker on a surfboard in a beach surf shop"
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
