import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Check, Lock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTier } from "@/hooks/use-tier";
import { FEATURE_META, TIER_LABEL, type TagTier, type TierFeatureKey } from "@/lib/tier";

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
    ])
    .optional(),
});

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — Tag" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: UpgradePage,
});

type Row = { label: string; starter: string | boolean; pro: string | boolean; enterprise: string | boolean };

const MATRIX: Row[] = [
  { label: "4-KPI recovery dashboard", starter: true, pro: true, enterprise: true },
  { label: "Engagement (Customers, Products, QR Tags, Watchlists, Compare)", starter: true, pro: true, enterprise: true },
  { label: "Alerts (Inbox, Composer, Campaign tracker)", starter: true, pro: true, enterprise: true },
  { label: "Coupon redemption", starter: true, pro: true, enterprise: true },
  { label: "Basic campaign performance", starter: true, pro: true, enterprise: true },
  { label: "Stores", starter: "1", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "Bulk QR & PDF export", starter: false, pro: true, enterprise: true },
  { label: "AI campaign assistant", starter: false, pro: true, enterprise: true },
  { label: "Advanced campaign analytics", starter: false, pro: true, enterprise: true },
  { label: "Exports", starter: false, pro: "CSV / XLSX", enterprise: "CSV / XLSX + scheduled" },
  { label: "Intelligence suite", starter: false, pro: false, enterprise: true },
  { label: "Performance & ROI", starter: false, pro: false, enterprise: true },
  { label: "Weekly AI briefings + executive summary", starter: false, pro: false, enterprise: true },
  { label: "Intent score engine + weight tuning", starter: false, pro: false, enterprise: true },
  { label: "API access / SSO / audit log export", starter: false, pro: false, enterprise: true },
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
              Included in {TIER_LABEL[minTierFor(feature as TierFeatureKey)]}
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <PlanCard
          name="Starter"
          tagline="The recovery essentials"
          price="Free during pilot"
          current={tier === "starter"}
          highlights={[
            "QR tags, customer opt-in, WhatsApp notifications",
            "Two-way inbox and coupon redemption",
            "4-KPI recovery dashboard",
            "1 store",
          ]}
        />
        <PlanCard
          name="Pro"
          tagline="Scale your recovery loop"
          price="Contact sales"
          featured={tier !== "enterprise"}
          current={tier === "pro"}
          highlights={[
            "Everything in Starter, plus",
            "Multi-store management",
            "Bulk QR & PDF export",
            "AI campaign assistant",
            "CSV / XLSX exports",
          ]}
        />
        <PlanCard
          name="Enterprise"
          tagline="Retail intelligence at scale"
          price="Custom pricing"
          current={tier === "enterprise"}
          highlights={[
            "Everything in Pro, plus",
            "Intelligence suite (insights, forecasting, trends)",
            "Performance & ROI engine",
            "Weekly AI briefings + executive summary",
            "Intent score engine",
            "API access, SSO, audit log export",
          ]}
        />
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
                  <th className="px-6 py-3 font-medium">Feature</th>
                  <th className="px-6 py-3 font-medium">Starter</th>
                  <th className="px-6 py-3 font-medium">Pro</th>
                  <th className="px-6 py-3 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((r) => (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="px-6 py-3">{r.label}</td>
                    <Cell v={r.starter} />
                    <Cell v={r.pro} />
                    <Cell v={r.enterprise} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Billing goes live once we finalise the payment provider. Talk to us about a pilot.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/settings">Manage plan</Link>
          </Button>
          <Button asChild className="bg-[color:var(--mint)] text-white hover:bg-[color:var(--mint)]/90">
            <a href="mailto:hello@mypenguin.co.za?subject=Tag%20upgrade">Contact sales</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function minTierFor(key: TierFeatureKey): TagTier {
  const map: Record<TierFeatureKey, TagTier> = {
    intelligence: "enterprise",
    roi: "enterprise",
    weeklyBriefings: "enterprise",
    intentEngine: "enterprise",
    apiAccess: "enterprise",
    aiAssistant: "pro",
    bulkQr: "pro",
    advancedExports: "pro",
    multiStore: "pro",
  };
  return map[key];
}

function Cell({ v }: { v: string | boolean }) {
  if (v === true)
    return (
      <td className="px-6 py-3">
        <Check className="h-4 w-4 text-[color:var(--mint)]" />
      </td>
    );
  if (v === false)
    return <td className="px-6 py-3 text-muted-foreground">—</td>;
  return <td className="px-6 py-3 text-muted-foreground">{v}</td>;
}

function PlanCard({
  name,
  tagline,
  price,
  highlights,
  featured,
  current,
}: {
  name: string;
  tagline: string;
  price: string;
  highlights: string[];
  featured?: boolean;
  current?: boolean;
}) {
  return (
    <Card
      className={
        "rounded-2xl " +
        (featured
          ? "border-[color:var(--mint)] shadow-[0_8px_30px_-12px_rgba(0,176,116,0.25)]"
          : "")
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{name}</CardTitle>
          {current && (
            <Badge variant="outline" className="border-[color:var(--mint)]/50 text-[color:var(--mint)]">
              Current
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{tagline}</p>
        <p className="pt-2 text-lg font-semibold">{price}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {highlights.map((h) => (
            <li key={h} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--mint)]" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
