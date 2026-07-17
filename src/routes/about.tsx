import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { ArrowRight, ArrowDown } from "lucide-react";

import heroLogo from "@/assets/tag-logo-clear.png.asset.json";

export const Route = createFileRoute("/about")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "About Tag — Recover lost in-store sales" },
      {
        name: "description",
        content:
          "Tag transforms ordinary products into intelligent digital touchpoints that capture customer interest, reveal buying intent, and reconnect shoppers after they leave the store.",
      },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    n: "01",
    t: "Activate Your Products",
    d: "Tag converts your existing product barcodes into intelligent QR experiences — no need to replace your inventory or existing systems.",
  },
  {
    n: "02",
    t: "Customers Discover",
    d: "Shoppers scan the QR code to explore richer product information, compare options, ask questions, or register their interest before making a purchase.",
  },
  {
    n: "03",
    t: "Interest Is Captured",
    d: "Every interaction creates valuable signals. Tag records customer intent, product engagement, and behavioural insights that would otherwise be lost when a shopper leaves the store.",
  },
  {
    n: "04",
    t: "AI Reveals Hidden Opportunities",
    d: "Tag analyses thousands of product interactions to identify trends, predict demand, highlight missed sales opportunities, and recommend actions to improve performance.",
  },
  {
    n: "05",
    t: "Reconnect at the Right Moment",
    d: "Automatically notify interested customers when products go on sale, return to stock, become limited in quantity, or match personalised promotions.",
  },
  {
    n: "06",
    t: "Measure the Results",
    d: "Track the complete journey — from product discovery to customer engagement and final purchase — proving exactly how Tag helps recover revenue and strengthen customer relationships.",
  },
];

const FEATURES = [
  {
    emoji: "🏷️",
    title: "Intelligent Product Identity",
    body: "Transform your existing barcodes into dynamic QR experiences without changing your inventory, POS system, or product catalogue. Every product becomes a digital touchpoint that can educate, engage, and collect valuable customer insights.",
  },
  {
    emoji: "💡",
    title: "Interest Gap Detection",
    body: "Discover which products shoppers genuinely want — even when they leave the store without purchasing. Tag captures signals of buying intent that traditional retail systems never see.",
  },
  {
    emoji: "👥",
    title: "Customer Intelligence",
    body: "Build a richer understanding of your customers with every interaction. Learn what products they explore, what categories they prefer, and how their interests change over time.",
  },
  {
    emoji: "🤖",
    title: "AI Retail Intelligence",
    body: "Go beyond dashboards. Tag analyses customer behaviour and product performance to uncover hidden demand, identify sales opportunities, recommend actions, and predict where revenue can be recovered.",
  },
  {
    emoji: "💬",
    title: "Smart Customer Engagement",
    body: "Reconnect with interested shoppers through personalised WhatsApp notifications, price-drop alerts, back-in-stock updates, and targeted campaigns that bring customers back at exactly the right moment.",
  },
  {
    emoji: "📊",
    title: "Revenue & ROI Tracking",
    body: "Measure every campaign from first scan to final purchase. Track engagement, recovered sales, campaign performance, and the real business impact of every customer interaction.",
  },
];

const PILLARS = [
  {
    title: "Product Intelligence",
    body: "Understand how every product performs — from first scan to final sale — and which items generate real customer interest.",
  },
  {
    title: "Customer Intelligence",
    body: "Build a complete picture of shopper behaviour, preferences, and intent across every visit and interaction.",
  },
  {
    title: "Retail Intelligence",
    body: "See what's happening across your stores in real time — engagement, demand patterns, and opportunity as they emerge.",
  },
  {
    title: "Revenue Intelligence",
    body: "Connect every interaction back to recovered revenue, so you know exactly what Tag is worth to your business.",
  },
];

const CYCLE = ["Product", "Customer", "Retail", "Revenue", "AI", "Engagement", "Revenue"];

const REVEALS = [
  {
    title: "Understand Hidden Demand",
    body: "See which products attract attention, which categories generate the most interest, and where customers are leaving without buying.",
  },
  {
    title: "Identify the Interest Gap",
    body: "Measure the difference between customer curiosity and completed purchases. Discover exactly where sales opportunities are being lost and which products deserve immediate attention.",
  },
  {
    title: "Predict Customer Behaviour",
    body: "AI identifies buying patterns, highlights high-intent shoppers, predicts demand, and recommends the best time to engage customers for maximum conversion.",
  },
  {
    title: "Optimise Your Business",
    body: "Use real customer intelligence to improve pricing strategies, promotions, inventory planning, merchandising decisions, and marketing campaigns — all based on actual shopper behaviour rather than assumptions.",
  },
  {
    title: "Prove Your Return on Investment",
    body: "Know exactly how many customers returned, which campaigns generated revenue, which products performed best, and how much additional revenue Tag helped recover.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecked(true);
    });
  }, []);

  const primaryHref = authed ? "/dashboard" : "/auth";
  const primaryLabel = authed ? "Open dashboard" : "Sign in";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <img src={heroLogo.url} alt="Tag" className="mt-[2cm] h-56 md:h-72 w-auto object-contain" />
        <nav className="hidden items-center gap-8 text-base font-bold text-foreground md:flex">
          <a href="#how" className="hover:text-primary">
            How it works
          </a>
          <a href="#features" className="hover:text-primary">
            Features
          </a>
          <a href="#intelligence" className="hover:text-primary">
            Intelligence
          </a>
          <Link to="/pricing" className="hover:text-primary">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate({ to: primaryHref })} className="gap-2">
            {primaryLabel} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:py-28">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your customers are interested.
            <br />
            <span className="text-primary">Your products just don't know it yet.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Tag transforms ordinary products into intelligent digital touchpoints that capture
            customer interest, reveal buying intent, and reconnect shoppers after they leave the
            store — turning missed opportunities into measurable revenue.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate({ to: primaryHref })} className="gap-2">
              Book a Demo <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">See Tag in Action</a>
            </Button>
          </div>
        </div>
      </section>

      {/* The Problem — the retail blind spot */}
      <section id="problem" className="bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-[color:var(--mint)]">
            The Retail Blind Spot
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            You know what sold. You don't know what almost did.
          </h2>
          <div className="mx-auto mt-6 max-w-xl space-y-1 text-lg text-primary-foreground/80">
            <p>Retailers know what they sold.</p>
            <p>They know what's in stock.</p>
            <p>They know what customers bought.</p>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-xl font-semibold">
            But they don't know what customers wanted to buy.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            The missed opportunities. The abandoned decisions. The products that attracted
            attention but never converted.
          </p>
          <p className="mt-4 text-xl font-bold text-[color:var(--mint)]">Until now.</p>
        </div>
      </section>

      {/* How it works — the mechanics of the solution */}
      <section id="how" className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-bold uppercase tracking-wide text-primary">
              How it works
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              From barcode to business intelligence — in six simple steps.
            </h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="text-xs font-semibold text-primary">{s.n}</div>
                <div className="mt-2 text-base font-semibold">{s.t}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — what Tag does */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-primary">Features</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to understand customer intent and recover lost sales.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tag combines Product Intelligence, Customer Intelligence, AI-powered Insights, and
            Automated Engagement into one platform — helping retailers transform every product
            interaction into measurable business value.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ emoji, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border/60 bg-card p-6 transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">
                {emoji}
              </div>
              <div className="mt-4 text-base font-semibold">{title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Tag Intelligence Engine — the strategic differentiator */}
      <section id="intelligence" className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mx-auto max-w-2xl text-center text-muted-foreground">
            But Tag is not just a collection of features. Behind every scan, interaction, and
            customer decision is an intelligence layer that continuously learns and reveals
            opportunities.
          </p>
          <div className="mx-auto mt-6 max-w-2xl text-center">
            <span className="text-sm font-bold uppercase tracking-wide text-primary">
              The Tag Intelligence Engine™
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              The intelligence layer powering every product interaction.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="text-base font-semibold text-primary">{p.title}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>

          {/* Intelligence Cycle — the flywheel */}
          <div className="mt-16">
            <p className="text-center text-sm font-bold uppercase tracking-wide text-primary">
              The Intelligence Cycle
            </p>
            <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-3">
              {CYCLE.map((node, i) => (
                <div key={`${node}-${i}`} className="flex items-center gap-3">
                  <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold">
                    {node}
                  </span>
                  {i < CYCLE.length - 1 && (
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-md text-center text-xs text-muted-foreground">
              Each cycle feeds the next — revenue insight sharpens engagement, engagement sharpens
              intelligence, and intelligence uncovers more revenue.
            </p>
          </div>

          {/* What the engine reveals */}
          <div className="mt-16">
            <p className="text-center text-sm font-bold uppercase tracking-wide text-primary">
              What the Intelligence Engine reveals
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {REVEALS.map(({ title, body }) => (
                <div key={title} className="rounded-2xl border border-border/60 bg-card p-6">
                  <div className="text-base font-semibold">{title}</div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The Future of Retail Intelligence — proprietary concepts (the moat) */}
      <section id="proprietary" className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-primary">
            The Future of Retail Intelligence
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Beyond Transactions: Understanding Customer Intent.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Traditional retail sees
            </p>
            <p className="mt-4 text-lg font-semibold">Customer → Purchase</p>
          </div>
          <div className="rounded-2xl border border-primary bg-primary p-6 text-center text-primary-foreground">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mint)]">
              Tag sees
            </p>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold sm:text-base">
              {["Interest", "Consideration", "Intent", "Decision", "Purchase", "Relationship"].map(
                (step, i, arr) => (
                  <span key={step} className="flex items-center gap-2">
                    {step}
                    {i < arr.length - 1 && <ArrowDown className="h-3.5 w-3.5 rotate-[-90deg] opacity-60 sm:rotate-0" />}
                  </span>
                ),
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="text-lg font-bold">The Interest Gap™</div>
            <p className="mt-1 text-sm font-medium text-primary">
              The world's hidden retail opportunity.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The gap between what customers wanted and what retailers captured.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {[
                "Products scanned but not purchased",
                "Sizes unavailable",
                "Price hesitation",
                "Location mismatch",
                "Competitor comparison",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="text-lg font-bold">The Interest Graph™</div>
            <p className="mt-1 text-sm font-medium text-primary">
              The complete picture of customer intent.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Every interaction builds a richer understanding of demand. A customer doesn't just
              scan. They:
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-1.5 text-sm text-muted-foreground">
              {["Discover", "Compare", "Consider", "Return", "Share", "Decide"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-medium">Tag captures the journey.</p>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-1 text-center text-muted-foreground">
          <p>Retailers lose billions because they cannot see the Interest Gap.</p>
          <p>
            Tag creates the <span className="font-semibold text-foreground">Interest Graph</span>{" "}
            that reveals it.
          </p>
          <p>Both are powered by the Tag Intelligence Engine.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to recover the sales walking out the door?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Join retailers using Tag to turn every store visit into a long-term customer relationship.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={() => navigate({ to: primaryHref })} className="gap-2">
            Book a Demo <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Tag. Built for South African retail and beyond.
      </footer>
    </div>
  );
}
