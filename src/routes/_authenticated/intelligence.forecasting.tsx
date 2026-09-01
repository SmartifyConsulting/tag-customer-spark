import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { IntelligenceTabs } from "@/components/intelligence-tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IntentSectionsCard } from "@/components/dashboard/intent-sections-card";
import { requireFeature } from "@/lib/tier-guard";

export const Route = createFileRoute("/_authenticated/intelligence/forecasting")({
  head: () => ({ meta: [{ title: "Demand Forecasting — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "intelligence"),
  component: ForecastingPage,
});

function ForecastingPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Demand Forecasting"
        description="7, 14 and 30-day estimates, powered by the Interest Score data layer — accuracy depends on how much scan history a store has built up."
        actions={
          <Button variant="outline" asChild>
            <Link to="/settings">
              Forecast sensitivity <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <IntelligenceTabs />

      <Card className="rounded-xl shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[color:var(--mint)]" />
            Forecast horizons
          </CardTitle>
          <CardDescription>
            Per-product demand outlook over the next 7, 14 and 30 days based on interest
            momentum. Treat as a rough guide, not a guarantee — especially for a store still
            building up scan history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntentSectionsCard />
        </CardContent>
      </Card>
    </div>
  );
}
