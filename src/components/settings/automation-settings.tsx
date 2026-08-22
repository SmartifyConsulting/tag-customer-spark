import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, PlugZap, Send, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AUTOMATIONS, ALL_WHATSAPP_TEMPLATES, type AutomationSetting } from "@/lib/automation";
import {
  checkInfobipConnection,
  listAutomationSettings,
  saveAutomationSetting,
  testInfobipDelivery,
} from "@/lib/automation.functions";
import { useAuth } from "@/hooks/use-auth";

export function AutomationSettings() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const { data, isLoading } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: () => listAutomationSettings(),
  });

  const [draft, setDraft] = useState<Record<string, AutomationSetting>>({});
  const [testRecipient, setTestRecipient] = useState("");
  const [testTemplate, setTestTemplate] = useState<string>("tag_scan_confirm_and_install_v2");

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

  const testDelivery = useMutation({
    mutationFn: () =>
      testInfobipDelivery({
        data: { recipient: testRecipient, templateName: testTemplate.trim() },
      }),
    onSuccess: (result) => {
      if (result.ok) toast.success("Infobip accepted the test message");
      else toast.error(result.error ?? "Infobip rejected the test message");
    },
    onError: (e: Error) => toast.error(e.message || "Could not run delivery test"),
  });

  // Authentication-only probe: no message is sent, so a failure here points at
  // the credential binding rather than the template or the recipient.
  const connectionCheck = useMutation({
    mutationFn: () => checkInfobipConnection(),
    onSuccess: (result) => {
      if (result.ok) toast.success("Infobip authenticated this runtime");
      else toast.error(result.error ?? "Infobip rejected this runtime's credentials");
    },
    onError: (e: Error) => toast.error(e.message || "Could not check the connection"),
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
      {data?.lastFailure ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-destructive">Last WhatsApp send failed</p>
            <p className="text-muted-foreground">
              {data.lastFailure.template ? (
                <>Template <span className="font-medium text-foreground">{data.lastFailure.template}</span> — </>
              ) : null}
              {data.lastFailure.error}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(data.lastFailure.at).toLocaleString()} · check the WhatsApp sender number and API key.
            </p>
          </div>
        </div>
      ) : null}

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

      {isSuperAdmin && data?.provider === "infobip" ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Live Infobip delivery test</CardTitle>
                <CardDescription>
                  Sends the chosen template through the same runtime adapter used by Follow Me and
                  barcode scans, so you can prove a template delivers before making it the default.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void templates.refetch()}
                disabled={templates.isFetching}
              >
                {templates.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={testTemplate} onValueChange={setTestTemplate}>
                <SelectTrigger aria-label="Template to test" className="font-mono text-xs sm:max-w-[280px]">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((t) => (
                    <SelectItem key={t.name} value={t.name} className="font-mono text-xs">
                      <span className="flex items-center gap-2">
                        {t.name}
                        {t.status && t.status !== "APPROVED" ? (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {t.status.toLowerCase()}
                          </Badge>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                aria-label="WhatsApp test recipient"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="+27 82 123 4567"
                inputMode="tel"
              />
              <Button
                onClick={() => testDelivery.mutate()}
                disabled={
                  testDelivery.isPending ||
                  testRecipient.trim().length < 8 ||
                  testTemplate.trim().length === 0
                }
              >
                {testDelivery.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send test
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => connectionCheck.mutate()}
                disabled={connectionCheck.isPending}
              >
                {connectionCheck.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="mr-2 h-4 w-4" />
                )}
                Check connection
              </Button>
              {connectionCheck.data ? (
                <span className="flex items-center gap-2 text-sm">
                  {connectionCheck.data.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  {connectionCheck.data.ok
                    ? "Authenticated"
                    : `Rejected (${connectionCheck.data.status})`}
                  <span className="font-mono text-xs text-muted-foreground">
                    {connectionCheck.data.diagnostic?.keyBinding ?? "—"} ·{" "}
                    {connectionCheck.data.diagnostic?.keyFingerprint ?? "—"}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Authenticates against Infobip without sending a message.
                </span>
              )}
            </div>



            {testDelivery.data ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {testDelivery.data.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  {testDelivery.data.ok ? "Accepted by Infobip" : "Rejected by Infobip"}
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">HTTP status</dt><dd>{testDelivery.data.status}</dd></div>
                  <div><dt className="text-muted-foreground">Message ID</dt><dd className="break-all font-mono text-xs">{testDelivery.data.messageId ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Key fingerprint</dt><dd className="font-mono text-xs">{testDelivery.data.diagnostic?.keyFingerprint ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">API host</dt><dd className="break-all font-mono text-xs">{testDelivery.data.diagnostic?.apiHost ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Key length</dt><dd>{testDelivery.data.diagnostic?.keyLength ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Sender suffix</dt><dd>••••{testDelivery.data.diagnostic?.senderSuffix ?? "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">Provider request ID</dt><dd className="break-all font-mono text-xs">{testDelivery.data.diagnostic?.responseRequestId ?? "—"}</dd></div>
                </dl>
                {testDelivery.data.error ? <p className="mt-3 text-destructive">{testDelivery.data.error}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
