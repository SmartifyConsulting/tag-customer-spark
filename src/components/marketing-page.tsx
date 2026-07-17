import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing-nav";
import heroLogo from "@/assets/tag-logo-clear.png.asset.json";

// Shared chrome for every "sub" marketing page (Features, How it Works,
// Intelligence Engine, Intent Gap Analytics, Pricing) — logo + the same flat
// nav + a Start Setup CTA, so navigating between them never loses context.
export function MarketingHeader() {
  return (
    <header className="mx-auto flex max-w-7xl items-center gap-10 px-6 py-5">
      <Link to="/about">
        <img src={heroLogo.url} alt="Tag" className="h-16 w-auto object-contain md:h-20" />
      </Link>
      <MarketingNav showStartSetup />
    </header>
  );
}

export function MarketingCta() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);
  const primaryHref = authed ? "/dashboard" : "/auth";
  const primaryLabel = authed ? "Open dashboard" : "Start Setup";

  return (
    <section className="mx-auto max-w-7xl px-6 py-14 text-center">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Ready to recover the sales walking out the door?
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        Join retailers using Tag to turn every store visit into a long-term customer relationship.
      </p>
      <div className="mt-6 flex justify-center">
        <Button size="lg" onClick={() => navigate({ to: primaryHref })} className="gap-2">
          {primaryLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
      <p>© {new Date().getFullYear()} Tag. Built for Retail Intelligence.</p>
      <div className="mt-2 flex items-center justify-center gap-4">
        <Link to="/terms" className="hover:text-[color:var(--mint)] hover:underline">
          Terms and Conditions
        </Link>
        <span aria-hidden className="text-border">
          ·
        </span>
        <Link to="/privacy" className="hover:text-[color:var(--mint)] hover:underline">
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
