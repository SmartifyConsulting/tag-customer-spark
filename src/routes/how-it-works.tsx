import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingCta, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/how-it-works")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "How it Works — Tag" },
      {
        name: "description",
        content: "From barcode to business intelligence — in six simple steps.",
      },
    ],
  }),
  component: HowItWorksPage,
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

function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-base font-bold uppercase tracking-wide text-[color:var(--mint)]">
            How it works
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            From barcode to business intelligence — in six simple steps.
          </h1>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="text-xs font-semibold text-primary">{s.n}</div>
              <div className="mt-2 text-base font-semibold">{s.t}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}
