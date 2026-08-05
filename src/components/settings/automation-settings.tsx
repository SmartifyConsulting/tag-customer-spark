import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AUTOMATIONS, type AutomationSetting } from "@/lib/automation";
import { listAutomationSettings, saveAutomationSetting } from "@/lib/automation.functions";

export function AutomationSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: () => listAutomationSettings(),
  });

  const [draft, setDraft] = useState<Record<string, AutomationSetting>>({});

  useEffect(() => {
    if (!data?.settings) return;
    setDraft(Object.fromEntries(data.settings.map((s: AutomationSetting) => [s.automation_key, s])));
  }, [data]);

  const save = useMutation({
    mutationFn: (setting: AutomationSetting) => saveAutomationSetting({ data: setting }),
    onSuccess: () => {
      toast.success("Automation saved");
      qc.invalidateQueries({ queryKey: ["automation-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading automations…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
        <Zap className="mt-0.5 h-4 w-4 text-primary" />
        <p className="text-sm text-muted-foreground">
          Automations decide when Tag WhatsApps a customer who is watching a product. Tag owns the rules —
          WhatsApp only delivers the approved template.
          {data?.provider ? (
            <>
              {" "}Delivery provider:{" "}
              <span className="font-medium capitalize text-foreground">{data.provider}</span>.
            </>
          ) : null}
        </p>
      </div>

      {AUTOMATIONS.map((def) => {
        const current = draft[def.key];
        if (!current) return null;
        const update = (patch: Partial<AutomationSetting>) =>
          setDraft((d) => ({ ...d, [def.key]: { ...d[def.key], ...patch } }));

        return (
          <Card key={def.key}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {def.label}
                  {!current.enabled && <Badge variant="secondary">Off</Badge>}
                </CardTitle>
                <CardDescription>{def.description}</CardDescription>
              </div>
              <Switch
                checked={current.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
                aria-label={`Enable ${def.label}`}
              />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              {def.threshold !== null ? (
                <div className="space-y-1.5">
                  <Label>{def.thresholdLabel ?? "Threshold"}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={current.threshold ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, "");
                      update({ threshold: raw === "" ? null : Number(raw) });
                    }}
                    placeholder={String(def.threshold)}
                  />
                  {def.thresholdSuffix && (
                    <p className="text-xs text-muted-foreground">{def.thresholdSuffix}</p>
                  )}
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}

              <div className="space-y-1.5">
                <Label>WhatsApp template name</Label>
                <Input
                  value={current.template_name}
                  onChange={(e) => update({ template_name: e.target.value })}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Must exactly match a template already approved in your Infobip WhatsApp
                  Business account. A mismatch falls back to plain text — which only reaches
                  the customer if they messaged you in the last 24 hours.
                </p>
              </div>

              <Button
                onClick={() => save.mutate(current)}
                disabled={save.isPending}
                className="sm:w-auto"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
