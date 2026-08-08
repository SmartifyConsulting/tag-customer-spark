import { useEffect, useState, type ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing-page";
import { HeroV1, HeroV2, HeroV3 } from "@/components/hero-variants";

const HERO_VERSION_KEY = "tag-hero-version";
type HeroVersion = "v1" | "v2" | "v3";

function HeroVersionToggle({
  version,
  onChange,
}: {
  version: HeroVersion;
  onChange: (v: HeroVersion) => void;
}) {
  return (
    <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 text-xs">
      {(["v1", "v2", "v3"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 font-medium uppercase transition-colors ${
            version === v
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

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
  const [heroVersion, setHeroVersion] = useState<HeroVersion>("v1");

  useEffect(() => {
    const stored = window.localStorage.getItem(HERO_VERSION_KEY);
    if (stored === "v1" || stored === "v2" || stored === "v3") {
      setHeroVersion(stored);
    }
  }, []);

  function handleVersionChange(v: HeroVersion) {
    setHeroVersion(v);
    window.localStorage.setItem(HERO_VERSION_KEY, v);
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 lg:px-10">
      <MarketingHeader right={null} />

      <div className="mx-auto grid max-w-6xl items-start gap-10 pt-[3cm] lg:grid-cols-[1fr_1fr]">
        {/* Hero copy column */}
        <div className="hidden lg:block">
          <HeroVersionToggle version={heroVersion} onChange={handleVersionChange} />
          {heroVersion === "v1" && <HeroV1 />}
          {heroVersion === "v2" && <HeroV2 />}
          {heroVersion === "v3" && <HeroV3 />}
        </div>

        {/* Form column */}
        <div className="mx-auto w-full max-w-md space-y-4">
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
