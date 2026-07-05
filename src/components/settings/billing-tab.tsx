import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  getMySubscription,
  createPayfastCheckout,
  createPaypalOrder,
  capturePaypalOrder,
  cancelMySubscription,
  changePlan,
} from "@/lib/billing.functions";
import { PLANS, priceCents, formatZar, formatUsd, type PlanId, type Cycle } from "@/lib/billing/pricing";

export function BillingTab() {
  const qc = useQueryClient();
  const sub = useQuery({ queryKey: ["my-subscription"], queryFn: () => getMySubscription() });
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const currentTier = (sub.data?.retailer?.tier ?? "starter") as PlanId;
  const subRow = sub.data?.subscription as null | { current_period_end?: string; billing_cycle?: string; provider?: string; status?: string; cancel_at_period_end?: boolean };
  const purchases = sub.data?.purchases ?? [];

  const cancel = useMutation({
    mutationFn: () => cancelMySubscription(),
    onSuccess: () => { toast.success("Cancellation scheduled for period end"); qc.invalidateQueries({ queryKey: ["my-subscription"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current plan
                <Badge className="uppercase" variant={currentTier === "starter" ? "outline" : "default"}>
                  {currentTier}
                </Badge>
              </CardTitle>
              <CardDescription>
                {subRow?.current_period_end
                  ? `Renews ${new Date(subRow.current_period_end).toLocaleDateString()} · ${subRow.billing_cycle ?? "monthly"} · via ${subRow.provider ?? "n/a"}`
                  : "You're on the free Starter tier."}
              </CardDescription>
            </div>
            {subRow && subRow.status === "active" && !subRow.cancel_at_period_end && (
              <Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                Cancel at period end
              </Button>
            )}
            {subRow?.cancel_at_period_end && (
              <Badge variant="outline" className="border-warning text-warning">Cancels at period end</Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Change plan</h3>
          <p className="text-sm text-muted-foreground">Pay in Rand via PayFast, or in USD via PayPal.</p>
        </div>
        <div className="inline-flex rounded-lg border p-1 text-sm">
          <button
            className={`rounded-md px-3 py-1 ${cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setCycle("monthly")}
          >Monthly</button>
          <button
            className={`rounded-md px-3 py-1 ${cycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setCycle("annual")}
          >Annual · save 17%</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.values(PLANS)).map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan.id}
            cycle={cycle}
            currentTier={currentTier}
            hasActiveSub={!!subRow && subRow.status === "active"}
            activeProvider={(subRow?.provider as "payfast" | "paypal" | undefined) ?? null}
          />
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Last 20 payment attempts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sub.isLoading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : purchases.length === 0 ? (
            <div className="p-6"><EmptyState icon={CreditCard} title="No invoices yet" /></div>
          ) : (
            <div className="divide-y">
              {(purchases as Array<{ id: string; created_at: string; provider: string; plan: string; billing_cycle: string; amount_cents: number; currency: string; status: string }>).map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-6 py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{p.plan} · {p.billing_cycle}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()} · {p.provider}</p>
                  </div>
                  <span className="font-mono text-xs">{p.currency} {(p.amount_cents / 100).toFixed(2)}</span>
                  <Badge variant={p.status === "completed" ? "default" : p.status === "pending" ? "outline" : "destructive"} className="capitalize">{p.status}</Badge>
                  <span />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({ plan, cycle, currentTier }: { plan: PlanId; cycle: Cycle; currentTier: PlanId }) {
  const p = PLANS[plan];
  const isCurrent = currentTier === plan;
  const zar = priceCents(plan, cycle, "ZAR");
  const usd = priceCents(plan, cycle, "USD");
  const [busy, setBusy] = useState<null | "payfast" | "paypal">(null);

  const startPayfast = async () => {
    setBusy("payfast");
    try {
      const origin = window.location.origin;
      const { redirect_url } = await createPayfastCheckout({
        data: {
          plan,
          cycle,
          return_url: `${origin}/settings?tab=billing&paid=1`,
          cancel_url: `${origin}/settings?tab=billing&cancelled=1`,
          notify_url: `${origin}/api/public/webhooks/payfast-itn`,
        },
      });
      window.location.href = redirect_url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  const startPaypal = async () => {
    setBusy("paypal");
    try {
      const origin = window.location.origin;
      const { order_id, approve_url } = await createPaypalOrder({
        data: {
          plan,
          cycle,
          return_url: `${origin}/settings?tab=billing&paypal_order=${encodeURIComponent("")}`,
          cancel_url: `${origin}/settings?tab=billing&cancelled=1`,
        },
      });
      if (!approve_url) throw new Error("PayPal did not return an approval URL");
      const popup = window.open(approve_url, "paypal", "width=520,height=720");
      // Poll for popup close, then capture.
      const iv = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(iv);
          try {
            await capturePaypalOrder({ data: { order_id } });
            toast.success("Payment captured — your plan is being upgraded.");
            setTimeout(() => window.location.reload(), 500);
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(null);
          }
        }
      }, 700);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <Card className={`rounded-2xl ${isCurrent ? "border-mint" : ""}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{p.name}</span>
          {isCurrent && <Badge variant="outline" className="border-mint text-mint">Current</Badge>}
        </CardTitle>
        <CardDescription>{p.tagline}</CardDescription>
        <div className="mt-2">
          <p className="text-3xl font-bold tracking-tight">
            {zar === 0 ? "Free" : formatZar(zar)}
            {zar > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">/{cycle === "annual" ? "yr" : "mo"}</span>}
          </p>
          {usd > 0 && <p className="text-xs text-muted-foreground">or {formatUsd(usd)}/{cycle === "annual" ? "yr" : "mo"} in USD</p>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          {p.features.map((f) => (
            <li key={f} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {plan === "starter" ? (
          <Button variant="outline" className="w-full" disabled>Free tier</Button>
        ) : isCurrent ? (
          <Button variant="outline" className="w-full" disabled>Your current plan</Button>
        ) : (
          <div className="grid gap-2">
            <Button onClick={startPayfast} disabled={busy !== null}>
              {busy === "payfast" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pay with PayFast (ZAR)
            </Button>
            <Button variant="outline" onClick={startPaypal} disabled={busy !== null}>
              {busy === "paypal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Pay with PayPal (USD)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
