import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
    <div className="min-h-screen bg-muted/40 px-4 py-10 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1fr]">
        {/* Hero panel — hidden on small screens to keep the form the focus */}
        <div className="hidden lg:block">
          <img src={heroLogo.url} alt="Tag" className="h-48 w-auto object-contain" />
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-foreground xl:text-5xl">
            Turn in-store curiosity into{" "}
            <span className="text-primary">recovered revenue.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            Tag lets shoppers scan a product QR, opt into WhatsApp, and get notified the moment
            that item goes on sale, restocks, or runs low. The result: sales you used to lose at
            the door.
          </p>
        </div>

        {/* Form column */}
        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="flex justify-center lg:hidden">
            <img src={heroLogo.url} alt="Tag" className="h-32 w-auto object-contain" />
          </div>
          <div className="flex justify-end">
            <Link
              to="/about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              About Tag
            </Link>
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
