import { createFileRoute } from "@tanstack/react-router";
import { requireFeature } from "@/lib/tier-guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { IntentSectionsCard } from "@/components/dashboard/intent-sections-card";
import { getIntentWeights, updateIntentWeights } from "@/lib/intent.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/intent")({
  head: () => ({ meta: [{ title: "Intent Engine — Tag" }] }),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "intentEngine"),
  component: IntentPage,
});

const WEIGHT_FIELDS = [
  { key: "w_scans", label: "Scans" },
  { key: "w_repeat", label: "Repeat scans" },
  { key: "w_time", label: "Time on page" },
  { key: "w_viewers", label: "Unique viewers" },
  { key: "w_watchlist", label: "Watchlist adds" },
  { key: "w_notif", label: "Notification engagement" },
  { key: "w_conversion", label: "Conversion rate" },
  { key: "w_cart", label: "Add-to-cart rate" },
  { key: "w_price", label: "Price impact" },
] as const;

const DEFAULT_WEIGHTS = {
  w_scans: 0.15, w_repeat: 0.10, w_time: 0.10, w_viewers: 0.10,
  w_watchlist: 0.10, w_notif: 0.10, w_conversion: 0.20, w_cart: 0.10, w_price: 0.05,
};

function IntentPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["intent", "weights"],
    queryFn: () => getIntentWeights(),
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (!form && (data || !isLoading)) {
      setForm(
        data ?? {
          ...DEFAULT_WEIGHTS,
          forecast_sensitivity: "balanced",
          forecasting_enabled: true,
          update_frequency_minutes: 5,
        },
      );
    }
  }, [data, isLoading, form]);

  const total = useMemo(() => {
    if (!form) return 0;
    return WEIGHT_FIELDS.reduce((s, f) => s + Number(form[f.key] ?? 0), 0);
  }, [form]);

  const save = useMutation({
    mutationFn: () => updateIntentWeights({ data: {
      ...Object.fromEntries(WEIGHT_FIELDS.map(f => [f.key, Number(form[f.key])])),
      forecast_sensitivity: form.forecast_sensitivity,
      forecasting_enabled: !!form.forecasting_enabled,
      update_frequency_minutes: Number(form.update_frequency_minutes),
    } as any }),
    onSuccess: () => {
      toast.success("Intent settings saved");
      qc.invalidateQueries({ queryKey: ["intent"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Intent Score Engine"
        description="Real-time demand intent per product, with forecasting and merchandising insights."
      />

      <IntentSectionsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Scoring configuration
          </CardTitle>
          <CardDescription>
            Tune signal weights and the forecasting layer. Weights should approximately sum to 1.0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!form ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {WEIGHT_FIELDS.map(f => (
                  <div key={f.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{f.label}</Label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Number(form[f.key]).toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      min={0} max={1} step={0.01}
                      value={[Number(form[f.key])]}
                      onValueChange={(v) => setForm({ ...form, [f.key]: v[0] })}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>Weights total</span>
                <span className={`tabular-nums font-semibold ${Math.abs(total - 1) > 0.05 ? "text-amber-600" : "text-emerald-600"}`}>
                  {total.toFixed(2)}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Forecast sensitivity</Label>
                  <Select
                    value={form.forecast_sensitivity}
                    onValueChange={(v) => setForm({ ...form, forecast_sensitivity: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Recompute frequency (minutes)</Label>
                  <Input
                    type="number" min={1} max={60}
                    value={form.update_frequency_minutes}
                    onChange={(e) => setForm({ ...form, update_frequency_minutes: e.target.value })}
                  />
                </div>
                <div className="flex items-end justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm">Forecasting enabled</Label>
                    <p className="text-xs text-muted-foreground">Predict 7- and 14-day intent.</p>
                  </div>
                  <Switch
                    checked={!!form.forecasting_enabled}
                    onCheckedChange={(v) => setForm({ ...form, forecasting_enabled: v })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setForm({
                    ...form,
                    ...DEFAULT_WEIGHTS,
                    forecast_sensitivity: "balanced",
                    update_frequency_minutes: 5,
                    forecasting_enabled: true,
                  })}
                >
                  Reset to defaults
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
