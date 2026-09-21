import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Copy, ExternalLink, EyeOff, KeyRound, Loader2, Lock, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import {
  INTEGRATION_GROUPS,
  INTEGRATION_PROVIDERS,
  type IntegrationProvider,
} from "@/lib/integrations.catalog";
import {
  listIntegrations,
  revealIntegrationSecrets,
  type IntegrationStatus,
} from "@/lib/integrations.functions";

/** Revealed values are cleared from the page after this long. */
const REVEAL_TTL_MS = 60_000;

async function copyValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy the ${label.toLowerCase()} — copy it from the field instead.`);
  }
}

type View = "apps" | "keys";

export function IntegrationsTab() {
  const load = useServerFn(listIntegrations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations-overview"],
    queryFn: () => load(),
    retry: false,
  });
  const [view, setView] = useState<View>("apps");

  const statusById = useMemo(
    () => Object.fromEntries((data?.providers ?? []).map((p) => [p.id, p])) as Record<string, IntegrationStatus>,
    [data],
  );

  if (error) {
    const forbidden = error.message.includes("restricted to the system administrator");
    return (
      <p className="text-sm text-muted-foreground">
        {forbidden ? "This area is restricted to the system administrator." : error.message}
      </p>
    );
  }

  const withSecrets = INTEGRATION_PROVIDERS.filter((p) => p.fields.some((f) => f.secret));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Keys on this page are read from TAG's server secrets and are never sent to your browser unless you
          press <strong>Reveal</strong> and enter the vault password. To change a key, edit it in
          Lovable Cloud › Secrets. Only the system administrator can open this page.
        </p>
      </div>

      {data && !data.vaultConfigured && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-foreground">
            No vault password is set, so nothing can be revealed. Add a secret named{" "}
            <code className="rounded bg-muted px-1">INTEGRATIONS_VAULT_PASSWORD</code> in Lovable Cloud › Secrets.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "apps" ? "default" : "outline"} onClick={() => setView("apps")}>
          <Plug className="mr-1.5 h-3.5 w-3.5" /> All apps
        </Button>
        <Button size="sm" variant={view === "keys" ? "default" : "outline"} onClick={() => setView("keys")}>
          <KeyRound className="mr-1.5 h-3.5 w-3.5" /> API keys
        </Button>
        <span className="text-xs text-muted-foreground">
          {view === "apps"
            ? "Every app TAG connects to, and whether it is set up."
            : "Every key and secret TAG uses, in one list."}
        </span>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && view === "apps" &&
        INTEGRATION_GROUPS.map((group) => {
          const providers = INTEGRATION_PROVIDERS.filter((p) => p.group === group);
          if (providers.length === 0) return null;
          return (
            <section key={group} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {group}
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {providers.length}
                </Badge>
              </h3>
              <div className="space-y-2">
                {providers.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    status={statusById[p.id]}
                    vaultConfigured={data.vaultConfigured}
                  />
                ))}
              </div>
            </section>
          );
        })}

      {data && view === "keys" && (
        <div className="space-y-2">
          {withSecrets.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              status={statusById[p.id]}
              vaultConfigured={data.vaultConfigured}
              secretsOnly
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  status,
  vaultConfigured,
  secretsOnly = false,
}: {
  provider: IntegrationProvider;
  status: IntegrationStatus | undefined;
  vaultConfigured: boolean;
  secretsOnly?: boolean;
}) {
  const reveal = useServerFn(revealIntegrationSecrets);
  const [expanded, setExpanded] = useState(secretsOnly);
  const [prompt, setPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fields = (status?.fields ?? []).filter((f) => (secretsOnly ? f.secret : true));
  const required = (status?.fields ?? []).filter((f) => !f.optional);
  const requiredSet = required.filter((f) => f.isSet).length;
  const hasSecrets = provider.fields.some((f) => f.secret);

  const state: "none" | "ok" | "partial" | "empty" =
    provider.noKey ? "none" : requiredSet === 0 ? "empty" : requiredSet === required.length ? "ok" : "partial";

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setRevealed(null);
    setPrompt(false);
    setPassword("");
  }

  // Never leave revealed values behind when the card is closed or unmounted.
  useEffect(() => {
    if (!expanded) hide();
  }, [expanded]);
  useEffect(() => () => hide(), []);

  async function onReveal() {
    if (!password) return;
    setBusy(true);
    try {
      const values = await reveal({ data: { provider: provider.id, vaultPassword: password } });
      setRevealed(values);
      setPrompt(false);
      setPassword("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setRevealed(null);
        toast.info(`${provider.name} values hidden again.`);
      }, REVEAL_TTL_MS);
    } catch (err) {
      toast.error((err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Plug className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <h4 className="text-xs font-semibold">{provider.name}</h4>
            {state === "ok" && <Badge variant="secondary" className="text-[10px]">Configured</Badge>}
            {state === "partial" && (
              <Badge variant="outline" className="text-[10px] text-amber-600">Incomplete</Badge>
            )}
            {state === "empty" && <Badge variant="outline" className="text-[10px]">Not set up</Badge>}
            {state === "none" && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">No key needed</Badge>
            )}
            {!provider.noKey && (
              <span className="text-[10px] text-muted-foreground">
                {requiredSet}/{required.length} saved
              </span>
            )}
          </div>
          {!expanded && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{provider.summary}</p>}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">{provider.summary}</p>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Used at:</span> {provider.usedAt}
          </p>
          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline"
            >
              Open {provider.name} <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <div className="space-y-2">
            {fields.map((f) => {
              const full = f.secret ? revealed?.[f.key] : undefined;
              return (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">
                      {f.label}
                      {f.optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
                    </Label>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          f.isSet ? "text-[10px] font-medium text-emerald-600" : "text-[10px] text-muted-foreground"
                        }
                      >
                        {f.isSet ? "Saved" : "Not set"}
                      </span>
                      {full && (
                        <button
                          type="button"
                          title={`Copy ${f.label}`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => void copyValue(f.label, full)}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">{f.key}</p>
                  {full ? (
                    <PasswordInput readOnly value={full} className="font-mono text-xs" />
                  ) : (
                    <Input
                      readOnly
                      value={f.display}
                      placeholder={f.isSet ? "" : "Not set"}
                      className="font-mono text-xs"
                    />
                  )}
                  {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                </div>
              );
            })}
            {provider.noKey && (
              <p className="text-xs text-muted-foreground">This service is open and needs no credentials.</p>
            )}
          </div>

          {prompt && (
            <form
              className="flex items-end gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                void onReveal();
              }}
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor={`${provider.id}-vault`} className="text-xs">
                  Vault password
                </Label>
                <PasswordInput
                  id={`${provider.id}-vault`}
                  value={password}
                  autoComplete="off"
                  autoFocus
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={busy || !password}>
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirm
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setPrompt(false); setPassword(""); }}>
                Cancel
              </Button>
            </form>
          )}

          {hasSecrets && (
            <div className="flex flex-wrap items-center gap-2">
              {revealed ? (
                <>
                  <Button size="sm" variant="outline" onClick={hide}>
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Values hide again after 60 seconds or when you close this card.
                  </span>
                </>
              ) : (
                !prompt && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPrompt(true)}
                    disabled={!vaultConfigured}
                    title={vaultConfigured ? undefined : "No vault password is configured"}
                  >
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reveal
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
