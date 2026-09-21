import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Plug,
  XCircle,
} from "lucide-react";
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
  removeIntegration,
  revealIntegrationSecrets,
  saveIntegration,
  setIntegrationsVaultPassword,
  testIntegration,
  type IntegrationFieldStatus,
  type IntegrationStatus,
  type IntegrationsOverview,
  type TestResult,
} from "@/lib/integrations.functions";

/** Revealed values are cleared from the page after this long. */
const REVEAL_TTL_MS = 60_000;
const MIN_VAULT_PASSWORD = 10;

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
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations-overview"],
    queryFn: () => load(),
    retry: false,
  });
  const [view, setView] = useState<View>("apps");
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations-overview"] });

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
          Type a key here and press <strong>Save</strong>: it is stored encrypted, and a saved value overrides the
          one in Lovable Cloud › Secrets. Keys are never sent back to your browser unless you press{" "}
          <strong>Reveal</strong> and enter the vault password. Only the system administrator can open this page.
        </p>
      </div>

      {data && !data.storageReady && <StorageNotice />}
      {data?.problem && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-foreground">{data.problem}</p>
        </div>
      )}

      {data && <VaultCard vault={data.vault} storageReady={data.storageReady} onChanged={refresh} />}

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
                    overview={data}
                    onChanged={refresh}
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
              overview={data}
              onChanged={refresh}
              secretsOnly
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StorageNotice() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-xs text-foreground">
        Saving keys isn't switched on yet. Run the <code className="rounded bg-muted px-1">integration_credentials</code>{" "}
        SQL (file <code className="rounded bg-muted px-1">supabase/migrations/20260921160000_integration_credentials.sql</code>)
        in the Lovable SQL editor, then reload this page. Until then, keys are read from Lovable Cloud › Secrets only.
      </p>
    </div>
  );
}

// ---------- vault password ----------

function VaultCard({
  vault,
  storageReady,
  onChanged,
}: {
  vault: IntegrationsOverview["vault"];
  storageReady: boolean;
  onChanged: () => void;
}) {
  const setPassword = useServerFn(setIntegrationsVaultPassword);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave = storageReady && next.length >= MIN_VAULT_PASSWORD && next === confirm && !busy;

  async function save() {
    setBusy(true);
    try {
      await setPassword({ data: { password: next, ...(vault.configured ? { current } : {}) } });
      toast.success(vault.configured ? "Vault password changed" : "Vault password set");
      setCurrent("");
      setNext("");
      setConfirm("");
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form
      className="mt-3 grid gap-3 sm:max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) void save();
      }}
    >
      {vault.configured && (
        <div className="space-y-1">
          <Label htmlFor="vault-current" className="text-xs">
            Current vault password
          </Label>
          <PasswordInput
            id="vault-current"
            value={current}
            autoComplete="off"
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="vault-new" className="text-xs">
          {vault.configured ? "New vault password" : "Vault password"} (at least {MIN_VAULT_PASSWORD} characters)
        </Label>
        <PasswordInput id="vault-new" value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="vault-confirm" className="text-xs">
          Repeat it
        </Label>
        <PasswordInput
          id="vault-confirm"
          value={confirm}
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
        />
        {mismatch && <p className="text-[11px] text-destructive">The two passwords don't match.</p>}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!canSave || (vault.configured && !current)}>
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {vault.configured ? "Change password" : "Set vault password"}
        </Button>
        {vault.configured && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );

  if (!vault.configured) {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium">Set the vault password</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This password is asked for every time someone presses Reveal on a key. Only a scrambled version of it is
          stored, never the password itself. Choose something only you know.
        </p>
        {form}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Vault password is set
          {vault.source === "server" ? " (from a server secret — set one here to manage it from this screen)" : ""}.
        </p>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {vault.source === "server" ? "Set it here" : "Change password"}
          </Button>
        )}
      </div>
      {open && form}
    </div>
  );
}

// ---------- one app ----------

function ProviderCard({
  provider,
  status,
  overview,
  onChanged,
  secretsOnly = false,
}: {
  provider: IntegrationProvider;
  status: IntegrationStatus | undefined;
  overview: IntegrationsOverview;
  onChanged: () => void;
  secretsOnly?: boolean;
}) {
  const save = useServerFn(saveIntegration);
  const remove = useServerFn(removeIntegration);
  const reveal = useServerFn(revealIntegrationSecrets);
  const test = useServerFn(testIntegration);

  const [expanded, setExpanded] = useState(secretsOnly);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "save" | "test" | "reveal" | "remove">(null);
  const [prompt, setPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fields = (status?.fields ?? []).filter((f) => (secretsOnly ? f.secret : true));
  const required = (status?.fields ?? []).filter((f) => !f.optional);
  const requiredSet = required.filter((f) => f.isSet).length;
  const hasSecrets = provider.fields.some((f) => f.secret);
  const editable = provider.editable && overview.storageReady;
  const dirtyKeys = Object.keys(draft).filter((k) => draft[k] !== undefined);
  const canSave = editable && dirtyKeys.length > 0 && busy === null;

  const state: "none" | "ok" | "partial" | "empty" = provider.noKey
    ? "none"
    : requiredSet === 0
      ? "empty"
      : requiredSet === required.length
        ? "ok"
        : "partial";

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

  async function onSave() {
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const f of status?.fields ?? []) {
      const v = draft[f.key];
      if (v === undefined) continue;
      if (f.secret) secrets[f.key] = v;
      else config[f.key] = v;
    }
    setBusy("save");
    try {
      await save({ data: { provider: provider.id, config, secrets, clear: [] } });
      setDraft({});
      setResult(null);
      onChanged();
      toast.success(`${provider.name} saved`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onClear(key: string) {
    setBusy("save");
    try {
      await save({ data: { provider: provider.id, config: {}, secrets: {}, clear: [key] } });
      setDraft((d) => {
        const { [key]: _drop, ...rest } = d;
        return rest;
      });
      onChanged();
      toast.success("Saved value removed — the server secret (if any) applies again");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setBusy("remove");
    try {
      await remove({ data: { provider: provider.id } });
      setDraft({});
      setConfirmRemove(false);
      setResult(null);
      onChanged();
      toast.success(`${provider.name}: saved values removed`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    try {
      const r = await test({ data: { provider: provider.id } });
      setResult(r);
      if (r.ok) toast.success(r.message);
      else
        toast.error(r.message, {
          ...(r.detail ? { description: r.detail } : {}),
          ...(r.reason === "no_credits" && r.topUpUrl
            ? { action: { label: `Top up ${provider.name}`, onClick: () => window.open(r.topUpUrl, "_blank", "noopener,noreferrer") } }
            : {}),
        });
    } catch (err) {
      const r: TestResult = { ok: false, message: (err as Error).message };
      setResult(r);
      toast.error(r.message);
    } finally {
      setBusy(null);
    }
  }

  async function onReveal() {
    if (!password) return;
    setBusy("reveal");
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
      setBusy(null);
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
            {status?.hasSaved && (
              <Badge variant="outline" className="text-[10px] text-primary">Saved here</Badge>
            )}
            {!provider.noKey && (
              <span className="text-[10px] text-muted-foreground">
                {requiredSet}/{required.length} set
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
          <div className="flex flex-wrap gap-3">
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
            {provider.billingUrl && (
              <a
                href={provider.billingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline"
              >
                Billing & credit <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {!provider.editable && !provider.noKey && (
            <p className="text-[11px] text-muted-foreground">
              These are set in Lovable Cloud › Secrets and can't be changed here: the app needs them to reach its
              own database.
            </p>
          )}
          {status?.undecryptable && (
            <p className="text-[11px] text-destructive">
              Saved keys for this app can't be decrypted with the current encryption key. Enter them again.
            </p>
          )}

          <div className="space-y-3">
            {fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                editable={editable}
                draftValue={draft[f.key]}
                revealedValue={f.secret ? revealed?.[f.key] : undefined}
                busy={busy !== null}
                onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                onClear={() => void onClear(f.key)}
              />
            ))}
            {provider.noKey && (
              <p className="text-xs text-muted-foreground">This service is open and needs no credentials.</p>
            )}
          </div>

          {result && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              )}
              <span>
                {result.message}
                {result.detail ? ` — ${result.detail}` : ""}
              </span>
            </p>
          )}

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
              <Button type="submit" size="sm" disabled={busy !== null || !password}>
                {busy === "reveal" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirm
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setPrompt(false); setPassword(""); }}>
                Cancel
              </Button>
            </form>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {provider.editable && (
              <Button size="sm" onClick={onSave} disabled={!canSave}>
                {busy === "save" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            )}
            {provider.testable && (
              <Button size="sm" variant="outline" onClick={onTest} disabled={busy !== null}>
                {busy === "test" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Test connection
              </Button>
            )}
            {hasSecrets &&
              (revealed ? (
                <Button size="sm" variant="outline" onClick={hide}>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide
                </Button>
              ) : (
                !prompt && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPrompt(true)}
                    disabled={!overview.vault.configured || busy !== null}
                    title={overview.vault.configured ? undefined : "Set the vault password first"}
                  >
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reveal
                  </Button>
                )
              ))}
            {status?.hasSaved &&
              (confirmRemove ? (
                <span className="flex items-center gap-2 text-xs">
                  Remove everything saved here for {provider.name}?
                  <Button size="sm" variant="destructive" onClick={onRemove} disabled={busy !== null}>
                    {busy === "remove" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Yes, remove
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                    No
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)} disabled={busy !== null}>
                  Remove saved values
                </Button>
              ))}
          </div>
          {revealed && (
            <p className="text-[11px] text-muted-foreground">
              Values hide again after 60 seconds or when you close this card.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  editable,
  draftValue,
  revealedValue,
  busy,
  onChange,
  onClear,
}: {
  field: IntegrationFieldStatus;
  editable: boolean;
  draftValue: string | undefined;
  revealedValue: string | undefined;
  busy: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const sourceLabel =
    field.source === "screen" ? "Saved here" : field.source === "server" ? "Server secret" : "Not set";
  const id = `field-${field.key}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {field.label}
          {field.optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
        </Label>
        <div className="flex items-center gap-2">
          <span
            className={
              field.source === "none" ? "text-[10px] text-muted-foreground" : "text-[10px] font-medium text-emerald-600"
            }
          >
            {draftValue !== undefined && draftValue !== "" ? "Unsaved change" : sourceLabel}
          </span>
          {revealedValue && (
            <button
              type="button"
              title={`Copy ${field.label}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void copyValue(field.label, revealedValue)}
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          {editable && field.source === "screen" && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground underline hover:text-foreground disabled:opacity-50"
              onClick={onClear}
              disabled={busy}
              title="Forget the value saved here (the server secret, if any, applies again)"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">{field.key}</p>

      {field.secret ? (
        revealedValue ? (
          <PasswordInput readOnly value={revealedValue} className="font-mono text-xs" />
        ) : editable ? (
          <PasswordInput
            id={id}
            value={draftValue ?? ""}
            autoComplete="new-password"
            placeholder={field.isSet ? `${field.display} — type to replace` : "Paste the key to save it"}
            className="font-mono text-xs"
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input readOnly id={id} value={field.display} placeholder="Not set" className="font-mono text-xs" />
        )
      ) : (
        <Input
          id={id}
          readOnly={!editable}
          value={draftValue ?? field.display}
          placeholder={field.defaultValue ? `${field.defaultValue} (default)` : "Not set"}
          className="font-mono text-xs"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
      {field.inactive && (
        <p className="text-[11px] text-amber-600">
          Saved, but not active on the running server yet. It can take up to a minute; press Save again or reload
          if it doesn't clear.
        </p>
      )}
    </div>
  );
}
