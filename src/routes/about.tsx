import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-page";
import { TagLogo } from "@/components/tag-logo";

import { ArrowRight } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

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
