import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Check, Lock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTier } from "@/hooks/use-tier";
import { FEATURE_META, FEATURE_MIN_TIER, TIER_LABEL, type TagTier, type TierFeatureKey } from "@/lib/tier";
import { PLANS, SELF_SERVE_PLANS, formatZar } from "@/lib/billing/pricing";

const searchSchema = z.object({
  feature: z
    .enum([
      "intelligence",
      "roi",
      "aiAssistant",
      "weeklyBriefings",
      "intentEngine",
      "bulkQr",
      "advancedExports",
      "apiAccess",
      "multiStore",
      "opportunityFeed",
    ])
    .optional(),
});

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — Tag" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: UpgradePage,
});

const TIERS: TagTier[] = [...SELF_SERVE_PLANS, "enterprise"];

type Row = { label: string; values: Partial<Record<TagTier, string | boolean>> };

const MATRIX: Row[] = [
  { label: "Included notifications / month", values: { starter: "150", growth: "300", pro: "600", enterprise: "Negotiated" } },
  { label: "Overage rate", values: { starter: "R1.40", growth: "R1.30", pro: "R1.20", enterprise: "Volume" } },
  { label: "Alert types", values: { starter: "All 6", growth: "All 6", pro: "All 6", enterprise: "All" } },
  { label: "Inbox", values: { starter: "Full", growth: "Full", pro: "Full", enterprise: "Full" } },
  { label: "Coupon redemption", values: { starter: true, growth: true, pro: true, enterprise: true } },
  { label: "Scheduled campaigns", values: { starter: false, growth: true, pro: true, enterprise: true } },
  { label: "AI message assist", values: { starter: false, growth: true, pro: true, enterprise: true } },
  { label: "Stores", values: { starter: "1", growth: "1", pro: "3", enterprise: "Unlimited" } },
  { label: "Products", values: { starter: "20", growth: "50", pro: "Unlimited", enterprise: "Unlimited" } },
  { label: "User logins", values: { starter: "2", growth: "3", pro: "10", enterprise: "Unlimited" } },
  { label: "Campaign analytics", values: { starter: "Basic", growth: "Full", pro: "Full", enterprise: "Full" } },
  { label: "Intent score engine", values: { starter: false, growth: true, pro: true, enterprise: true } },
  { label: "ROI engine", values: { starter: false, growth: false, pro: true, enterprise: true } },
  { label: "AI daily briefing", values: { starter: false, growth: false, pro: true, enterprise: true } },
  { label: "Weekly ROI email", values: { starter: false, growth: false, pro: true, enterprise: true } },
  { label: "Pricing sensitivity + scan heatmap", values: { starter: false, growth: false, pro: true, enterprise: true } },
  { label: "Forecasting", values: { starter: false, growth: false, pro: "7 + 14 day", enterprise: "Custom" } },
  { label: "Cross-store intelligence", values: { starter: false, growth: false, pro: false, enterprise: true } },
  { label: "Executive briefings + CFO ROI", values: { starter: false, growth: false, pro: false, enterprise: true } },
  { label: "API access + SSO + custom exports", values: { starter: false, growth: false, pro: false, enterprise: true } },
  { label: "Dedicated account manager + SLA", values: { starter: false, growth: false, pro: false, enterprise: true } },
];

function UpgradePage() {
  const { feature } = Route.useSearch();
  const { tier } = useTier();
  const meta = feature ? FEATURE_META[feature as TierFeatureKey] : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={meta ? `Unlock ${meta.title}` : "Choose the right plan for your team"}
        description={
          meta
            ? meta.description
            : "Start with the essentials and grow into Intelligence and ROI when you're ready."
        }
      />

      {meta && (
        <Card className="rounded-2xl border-[color:var(--mint)]/40 bg-[color:var(--mint)]/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--mint)]/15 text-[color:var(--mint)]">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{meta.title}</p>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
              </div>
            </div>
            <Badge className="self-start bg-[color:var(--mint)] text-white sm:self-center">
              Included in {TIER_LABEL[FEATURE_MIN_TIER[feature as TierFeatureKey]]}
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((t) => {
          const p = PLANS[t];
          const price = t === "enterprise" ? "Custom/branch" : `${formatZar(p.monthly_zar_cents)}/mo`;
          return (
            <Card key={t} className={`flex flex-col rounded-2xl ${tier === t ? "border-[color:var(--mint)]" : ""} ${t === "enterprise" ? "bg-slate-950 text-slate-50" : ""}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={t === "enterprise" ? "text-slate-50" : undefined}>{p.name}</CardTitle>
                  {tier === t && <Badge variant="outline" className="border-[color:var(--mint)]/50 text-[color:var(--mint)]">Current</Badge>}
                </div>
                <p className={`text-sm ${t === "enterprise" ? "text-slate-300" : "text-muted-foreground"}`}>{p.tagline}</p>
                <p className="pt-2 text-lg font-semibold">{price}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {p.features.slice(0, 6).map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--mint)]" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--mint)]" />
            Compare every feature
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Feature</th>
                  {TIERS.map((t) => (
                    <th key={t} className="px-4 py-3 font-medium">{PLANS[t].name.replace("Tag ", "")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((r) => (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="px-4 py-3">{r.label}</td>
                    {TIERS.map((t) => <Cell key={t} v={r.values[t] ?? false} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Manage or switch your plan in settings. Tag Enterprise is quoted per branch — talk to sales.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/settings" search={{ tab: "billing" }}>Manage plan</Link>
          </Button>
          <Button asChild className="bg-[color:var(--mint)] text-white hover:bg-[color:var(--mint)]/90">
            <a href="mailto:hello@tag-tech.co.za?subject=Tag%20Enterprise">Contact sales</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Cell({ v }: { v: string | boolean }) {
  if (v === true)
    return (
      <td className="px-4 py-3">
        <Check className="h-4 w-4 text-[color:var(--mint)]" />
      </td>
    );
  if (v === false)
    return <td className="px-4 py-3 text-muted-foreground">—</td>;
  return <td className="px-4 py-3 text-muted-foreground">{v}</td>;
}
