import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingCtaButton } from "@/components/marketing-nav";
import heroLogo from "@/assets/GreenTag.png.asset.png";

// Shared header used by every top-level page (hero, auth, marketing subs).
// 3-column grid keeps the logo pinned top-left and the nav pills centered
// regardless of what sits in the right slot, so nothing jumps between pages.
export function MarketingHeader({
  right,
}: {
  right?: ReactNode;
}) {
  const rightSlot = right === undefined ? <MarketingCtaButton /> : right;
  return (
    <header className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-start gap-8 px-6 py-5">
      <Link to="/about">
        <img
          src={heroLogo}
          alt="Tag"
          className="h-[12rem] w-auto object-contain md:h-[13.2rem]"
        />
      </Link>
      <div className="flex justify-center pt-4">
        <MarketingNav />
      </div>
      <div className="flex items-start gap-2 pt-4">{rightSlot}</div>
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
