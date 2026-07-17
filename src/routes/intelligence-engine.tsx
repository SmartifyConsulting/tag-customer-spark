import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { MarketingHeader, MarketingCta, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/intelligence-engine")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "The Tag Intelligence Engine — Tag" },
      {
        name: "description",
        content: "The intelligence layer powering every product interaction.",
      },
    ],
  }),
  component: IntelligenceEnginePage,
});

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

function IntelligenceEnginePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <p className="mx-auto max-w-2xl text-center text-muted-foreground">
          Tag is not just a collection of features. Behind every scan, interaction, and customer
          decision is an intelligence layer that continuously learns and reveals opportunities.
        </p>
        <div className="mx-auto mt-6 max-w-2xl text-center">
          <span className="text-base font-bold uppercase tracking-wide text-[color:var(--mint)]">
            The Tag Intelligence Engine™
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            The intelligence layer powering every product interaction.
          </h1>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="text-base font-semibold text-primary">{p.title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        {/* Intelligence Cycle — the flywheel */}
        <div className="mt-10">
          <p className="text-center text-base font-bold uppercase tracking-wide text-[color:var(--mint)]">
            The Intelligence Cycle
          </p>
          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-3">
            {CYCLE.map((node, i) => (
              <div key={`${node}-${i}`} className="flex items-center gap-3">
                <span className="rounded-full bg-[color:var(--mint)] px-4 py-2 text-sm font-semibold text-white">
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
        <div className="mt-10">
          <p className="text-center text-base font-bold uppercase tracking-wide text-[color:var(--mint)]">
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
      </section>
      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}
