import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IntentSectionsCard } from "@/components/dashboard/intent-sections-card";

export const Route = createFileRoute("/_authenticated/intelligence/forecasting")({
  head: () => ({ meta: [{ title: "Demand Forecasting — Tag" }] }),
  component: ForecastingPage,
});

function ForecastingPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Demand Forecasting"
        description="7, 14 and 30-day predictions, powered by the Intent Score data layer."
        actions={
          <Button variant="outline" asChild>
            <Link to="/settings">
              Forecast sensitivity <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <Card className="rounded-xl shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[color:var(--mint)]" />
            Forecast horizons
          </CardTitle>
          <CardDescription>
            Per-product demand outlook over the next 7, 14 and 30 days based on intent momentum.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntentSectionsCard />
        </CardContent>
      </Card>
    </div>
  );
}
