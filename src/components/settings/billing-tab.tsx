import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, ExternalLink, Loader2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import {
  getMySubscription,
  createPayfastCheckout,
  createPaypalOrder,
  capturePaypalOrder,
  cancelMySubscription,
  changePlan,
  getMyUsage,
  contactSalesForEnterprise,
} from "@/lib/billing.functions";
import { PLANS, SELF_SERVE_PLANS, priceCents, formatZar, formatUsd, type PlanId, type Cycle } from "@/lib/billing/pricing";

export function BillingTab() {
  const qc = useQueryClient();
  const sub = useQuery({ queryKey: ["my-subscription"], queryFn: () => getMySubscription() });
  const usage = useQuery({ queryKey: ["my-usage"], queryFn: () => getMyUsage() });
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const currentTier = (sub.data?.retailer?.tier ?? "starter") as PlanId;
  const subRow = sub.data?.subscription as null | { current_period_end?: string; billing_cycle?: string; provider?: string; status?: string; cancel_at_period_end?: boolean };
  const purchases = sub.data?.purchases ?? [];

  const initialSelected: PlanId =
    currentTier === "enterprise" || currentTier === "go" ? "starter" : currentTier;
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(initialSelected);
  const [payBusy, setPayBusy] = useState<null | "payfast" | "paypal">(null);

  const cancel = useMutation({
    mutationFn: () => cancelMySubscription(),
    onSuccess: () => { toast.success("Cancellation scheduled for period end"); qc.invalidateQueries({ queryKey: ["my-subscription"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedPlanData = PLANS[selectedPlan];
  const selectedZar = priceCents(selectedPlan, cycle, "ZAR");
  const selectedUsd = priceCents(selectedPlan, cycle, "USD");
  const cycleSuffix = cycle === "annual" ? "yr" : "mo";

  const startPayfast = async () => {
    setPayBusy("payfast");
    try {
      const origin = window.location.origin;
      const { redirect_url } = await createPayfastCheckout({
        data: {
          plan: selectedPlan,
          cycle,
          return_url: `${origin}/settings?tab=billing&paid=1`,
          cancel_url: `${origin}/settings?tab=billing&cancelled=1`,
          notify_url: `${origin}/api/public/webhooks/payfast-itn`,
        },
      });
      window.location.href = redirect_url;
    } catch (e) {
      toast.error((e as Error).message);
      setPayBusy(null);
    }
  };

  const startPaypal = async () => {
    setPayBusy("paypal");
    try {
      const origin = window.location.origin;
      const { order_id, approve_url } = await createPaypalOrder({
        data: {
          plan: selectedPlan,
          cycle,
          return_url: `${origin}/settings?tab=billing&paypal_order=${encodeURIComponent("")}`,
          cancel_url: `${origin}/settings?tab=billing&cancelled=1`,
        },
      });
      if (!approve_url) throw new Error("PayPal did not return an approval URL");
      const popup = window.open(approve_url, "paypal", "width=520,height=720");
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
            setPayBusy(null);
          }
        }
      }, 700);
    } catch (e) {
      toast.error((e as Error).message);
      setPayBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current plan
                <Badge className="uppercase" variant={currentTier === "go" ? "outline" : "default"}>
                  {PLANS[currentTier]?.name ?? currentTier}
                </Badge>
              </CardTitle>
              <CardDescription>
                {subRow?.current_period_end
                  ? `Renews ${new Date(subRow.current_period_end).toLocaleDateString()} · ${subRow.billing_cycle ?? "monthly"} · via ${subRow.provider ?? "n/a"}`
                  : "No active subscription — pick a plan below to start."}
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

      <UsageCard usage={usage.data} loading={usage.isLoading} />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Choose a plan</h3>
          <p className="text-sm text-muted-foreground">Select a plan, then pay in Rand via PayFast or USD via PayPal.</p>
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SELF_SERVE_PLANS.map((plan) => (
          <PlanCard
            key={plan}
            plan={plan}
            cycle={cycle}
            currentTier={currentTier}
            hasActiveSub={!!subRow && subRow.status === "active"}
            activeProvider={(subRow?.provider as "payfast" | "paypal" | undefined) ?? null}
            selected={selectedPlan === plan}
            onSelect={() => setSelectedPlan(plan)}
          />
        ))}
        <EnterpriseCard currentTier={currentTier} />
      </div>

      <Card className="rounded-2xl border-mint/40">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Selected plan</p>
            <p className="text-base font-semibold">
              {selectedPlanData.name} · {cycle === "annual" ? "Annual" : "Monthly"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {formatZar(selectedZar)}/{cycleSuffix}
                {selectedUsd > 0 && <> · {formatUsd(selectedUsd)}/{cycleSuffix}</>}
              </span>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={startPayfast} disabled={payBusy !== null}>
              {payBusy === "payfast" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pay with PayFast · {formatZar(selectedZar)}/{cycleSuffix}
            </Button>
            <Button variant="outline" onClick={startPaypal} disabled={payBusy !== null}>
              {payBusy === "paypal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Pay with PayPal · {formatUsd(selectedUsd)}/{cycleSuffix}
            </Button>
          </div>
        </CardContent>
      </Card>

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

function UsageCard({ usage, loading }: { usage: { included_count: number; sent_count: number; overage_cents_accrued: number; period_end: string } | null | undefined; loading: boolean }) {
  if (loading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (!usage) return null;
  const pct = usage.included_count > 0 ? Math.min(100, (usage.sent_count / usage.included_count) * 100) : 0;
  const overCount = Math.max(0, usage.sent_count - usage.included_count);
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Usage this period</CardTitle>
        <CardDescription>
          {usage.sent_count.toLocaleString()} / {usage.included_count.toLocaleString()} notifications sent
          {overCount > 0 && <> · <span className="text-warning">{overCount.toLocaleString()} overage</span></>}
          {usage.period_end && <> · resets {new Date(usage.period_end).toLocaleDateString()}</>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={pct} />
        {usage.overage_cents_accrued > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Projected overage charge: <span className="font-medium text-foreground">{formatZar(usage.overage_cents_accrued)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanCard({
  plan,
  cycle,
  currentTier,
  hasActiveSub,
  activeProvider,
  selected,
  onSelect,
}: {
  plan: PlanId;
  cycle: Cycle;
  currentTier: PlanId;
  hasActiveSub: boolean;
  activeProvider: "payfast" | "paypal" | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const qc = useQueryClient();
  const p = PLANS[plan];
  const isCurrent = currentTier === plan;
  const zar = priceCents(plan, cycle, "ZAR");
  const usd = priceCents(plan, cycle, "USD");
  const [busy, setBusy] = useState(false);

  const doSwitch = async () => {
    setBusy(true);
    try {
      const r = await changePlan({ data: { tier: plan, cycle } });
      if (r.provider_redirect) {
        toast.info("Use the PayFast or PayPal button below to complete the change.");
      } else {
        toast.success("Plan updated");
        qc.invalidateQueries({ queryKey: ["my-subscription"] });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cycleLabel = cycle === "annual" ? "annual" : "monthly";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left transition-all ${selected ? "ring-2 ring-mint" : "hover:ring-1 hover:ring-border"} rounded-2xl`}
    >
      <Card className={`flex h-full flex-col rounded-2xl ${isCurrent ? "border-mint" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>{p.name}</span>
            {isCurrent && <Badge variant="outline" className="border-mint text-mint">Current</Badge>}
          </CardTitle>
          <div className="mt-1">
            <p className="text-2xl font-bold tracking-tight">
              {formatZar(zar)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">/{cycle === "annual" ? "yr" : "mo"}</span>
            </p>
            {usd > 0 && <p className="text-[11px] text-muted-foreground">or {formatUsd(usd)}/{cycle === "annual" ? "yr" : "mo"} in USD</p>}
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
          <ul className="space-y-1 text-xs">
            {p.features.slice(0, 5).map((f) => (
              <li key={f} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {!isCurrent && hasActiveSub && activeProvider && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); doSwitch(); }}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Switch to {p.name} ({cycleLabel})
            </Button>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

function EnterpriseCard({ currentTier }: { currentTier: PlanId }) {
  const p = PLANS.enterprise;
  const isCurrent = currentTier === "enterprise";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", branches: "", message: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      await contactSalesForEnterprise({
        data: {
          name: form.name,
          email: form.email,
          company: form.company || undefined,
          branches: form.branches ? parseInt(form.branches, 10) : undefined,
          message: form.message || undefined,
        },
      });
      toast.success("Thanks — our team will be in touch within one business day.");
      setOpen(false);
      setForm({ name: "", email: "", company: "", branches: "", message: "" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex h-full flex-col rounded-2xl bg-slate-950 text-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base text-slate-50">
          <span>{p.name}</span>
          {isCurrent && <Badge variant="outline" className="border-mint text-mint">Current</Badge>}
        </CardTitle>
        <CardDescription className="text-slate-300">{p.tagline}</CardDescription>
        <div className="mt-1">
          <p className="text-2xl font-bold tracking-tight">Custom<span className="ml-1 text-xs font-normal text-slate-400">/branch</span></p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
        <ul className="space-y-1 text-xs">
          {p.features.slice(0, 5).map((f) => (
            <li key={f} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-mint text-slate-950 hover:bg-mint/90">
              <Building2 className="mr-2 h-4 w-4" />
              Contact sales
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tag Enterprise — Contact sales</DialogTitle>
              <DialogDescription>Tell us about your chain and we'll design a per-branch quote.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5"><Label htmlFor="cs-name">Your name</Label><Input id="cs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="cs-email">Email</Label><Input id="cs-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="cs-company">Company</Label><Input id="cs-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="cs-branches">Number of branches</Label><Input id="cs-branches" type="number" min={1} value={form.branches} onChange={(e) => setForm({ ...form, branches: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="cs-message">What are you looking for?</Label><Textarea id="cs-message" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
