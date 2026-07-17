import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-page";

import { ArrowRight } from "lucide-react";

import heroLogo from "@/assets/tag-logo-clear.png.asset.json";

export const Route = createFileRoute("/about")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tag — Recover lost in-store sales" },
      {
        name: "description",
        content:
          "Tag brings Retail Intelligence to physical stores, transforming ordinary products into intelligent digital touchpoints that capture buying intent and reconnect with shoppers after they leave.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  const primaryHref = authed ? "/dashboard" : "/auth";
  const primaryLabel = authed ? "Open dashboard" : "Sign in";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center gap-10 px-6 py-5">
        <img
          src={heroLogo.url}
          alt="Tag"
          className="mt-[2cm] h-[22.4rem] w-auto object-contain md:h-[28.8rem]"
        />
        <MarketingNav />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate({ to: primaryHref })} className="gap-2">
            {primaryLabel}
          </Button>
          {!authed && (
            <Button onClick={() => navigate({ to: "/auth" })} className="gap-2">
              Start Setup <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="mx-auto max-w-4xl px-6 py-14 text-center lg:py-20">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your customers are interested—your products just don't know it yet.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            You know exactly what sold. You don't know what almost did. Tag brings{" "}
            <span className="font-bold text-foreground">Retail Intelligence</span> to physical
            stores, transforming ordinary products into intelligent digital touchpoints that
            capture buying intent, reveal abandoned decisions, and reconnect with shoppers after
            they leave.
          </p>
          <p className="mt-4 text-lg font-semibold text-primary">No more blind spots.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate({ to: primaryHref })} className="gap-2">
              Book a Demo <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate({ to: "/intelligence-engine" })}>
              See Retail Intelligence in Action
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
