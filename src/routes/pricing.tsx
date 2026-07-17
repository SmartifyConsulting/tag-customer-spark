import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingCta, MarketingFooter } from "@/components/marketing-page";
import { PLANS, SELF_SERVE_PLANS, priceCents, formatZar, formatUsd, type Cycle } from "@/lib/billing/pricing";

export const Route = createFileRoute("/pricing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pricing — Tag" },
      {
        name: "description",
        content: "One flat plan per store size. No hidden fees — see exactly what Tag costs.",
      },
    ],
  }),
  component: PricingPage,
});

// The plan the hero highlights — the one most retailers should land on.
const FEATURED = "growth" as const;

function PricingPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const featured = PLANS[FEATURED];
  const featuredZar = priceCents(FEATURED, cycle, "ZAR");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      {/* Hero — one flat price per store size, Fynbos-style clarity */}
      <section className="mx-auto max-w-3xl px-6 pb-10 pt-14 text-center">
        <span className="text-base font-bold uppercase tracking-wide text-[color:var(--mint)]">
          One flat fee. No surprises.
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Pricing that scales with your store, not against it.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Every plan includes WhatsApp engagement, QR product tags, and customer intelligence.
          Cancel anytime — no long-term contract.
        </p>

        <div className="mt-8 inline-flex rounded-full border border-border p-1 text-sm">
          <button
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setCycle("monthly")}
          >
            Monthly
          </button>
          <button
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${cycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setCycle("annual")}
          >
            Annual — save 17%
          </button>
        </div>
      </section>

      {/* Featured plan — the Fynbos "one big price card" treatment */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <span className="inline-block rounded-full bg-[color:var(--mint)]/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--mint)]">
            Most popular
          </span>
          <h2 className="mt-4 text-2xl font-bold">{featured.name}</h2>
          <p className="mt-1 text-muted-foreground">{featured.tagline}</p>
          <p className="mt-6 text-5xl font-bold tracking-tight">
            {formatZar(featuredZar)}
            <span className="text-lg font-normal text-muted-foreground">
              /{cycle === "annual" ? "yr" : "mo"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or {formatUsd(priceCents(FEATURED, cycle, "USD"))}/{cycle === "annual" ? "yr" : "mo"} via
            PayPal
          </p>
          <Button size="lg" className="mt-6 gap-2" onClick={() => navigate({ to: "/auth" })}>
            Start with {featured.name} <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">Cancel anytime, no questions asked.</p>

          <div className="mt-8 grid gap-2 border-t border-border pt-8 text-left sm:grid-cols-2">
            {featured.features.map((f) => (
              <div key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--mint)]" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Every plan, side by side */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Not the right fit? Every stage of retail, covered.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <PlanTile planId="go" cycle={cycle} />
          {SELF_SERVE_PLANS.map((p) => (
            <PlanTile key={p} planId={p} cycle={cycle} featured={p === FEATURED} />
          ))}
          <EnterpriseTile />
        </div>
      </section>

      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}

function PlanTile({
  planId,
  cycle,
  featured,
}: {
  planId: keyof typeof PLANS;
  cycle: Cycle;
  featured?: boolean;
}) {
  const p = PLANS[planId];
  const zar = priceCents(planId, cycle, "ZAR");
  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 ${featured ? "border-[color:var(--mint)] shadow-md" : "border-border"}`}
    >
      <div className="text-sm font-semibold">{p.name}</div>
      <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        {formatZar(zar)}
        <span className="text-xs font-normal text-muted-foreground">
          /{cycle === "annual" ? "yr" : "mo"}
        </span>
      </p>
      <ul className="mt-4 flex-1 space-y-1.5 text-xs">
        {p.features.slice(0, 4).map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--mint)]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EnterpriseTile() {
  const p = PLANS.enterprise;
  return (
    <div className="flex flex-col rounded-2xl bg-primary p-5 text-primary-foreground">
      <div className="text-sm font-semibold">{p.name}</div>
      <p className="mt-1 text-xs opacity-80">{p.tagline}</p>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        Custom<span className="text-xs font-normal opacity-80">/branch</span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        className="mt-4 w-fit"
        asChild
      >
        <a href="mailto:hello@mypenguin.co.za?subject=Tag%20Enterprise">Contact sales</a>
      </Button>
    </div>
  );
}
