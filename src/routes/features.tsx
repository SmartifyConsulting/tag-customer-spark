import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingCta, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/features")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Features — Tag" },
      {
        name: "description",
        content: "Everything you need to understand customer intent and recover lost sales.",
      },
    ],
  }),
  component: FeaturesPage,
});

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

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-primary">Features</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to understand customer intent and recover lost sales.
          </h1>
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
      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}
