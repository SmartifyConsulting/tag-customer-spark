import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown } from "lucide-react";
import { MarketingHeader, MarketingCta, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/intent-gap-analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Intent Gap Analytics — Tag" },
      {
        name: "description",
        content:
          "Beyond transactions: the Interest Gap and the Interest Graph, the proprietary concepts behind Tag.",
      },
    ],
  }),
  component: IntentGapAnalyticsPage,
});

function IntentGapAnalyticsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="text-center">
          <span className="text-base font-bold uppercase tracking-wide text-[color:var(--mint)]">
            The Future of Retail Intelligence
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Beyond Transactions: Understanding Customer Intent.
          </h1>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Traditional retail sees
            </p>
            <p className="mt-4 text-lg font-semibold">Customer → Purchase</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--mint)] bg-card p-6 text-center text-foreground">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mint)]">
              Tag sees
            </p>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold sm:text-base">
              {["Interest", "Consideration", "Intent", "Decision", "Purchase", "Relationship"].map(
                (step, i, arr) => (
                  <span key={step} className="flex items-center gap-2">
                    {step}
                    {i < arr.length - 1 && (
                      <ArrowDown className="h-3.5 w-3.5 rotate-[-90deg] opacity-60 sm:rotate-0" />
                    )}
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
      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}
