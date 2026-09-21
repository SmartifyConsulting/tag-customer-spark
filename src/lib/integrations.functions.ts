import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INTEGRATION_PROVIDERS, providerById, type IntegrationProvider } from "@/lib/integrations.catalog";

// Admin > Integrations. Values come from the server environment (Lovable Cloud
// › Secrets) and/or values saved from the screen (encrypted in the database;
// a saved value wins). Only super admins can call any of this, and a secret
// leaves the server in full only through revealIntegrationSecrets, behind the
// vault password.

/** Older deployments bound the Infobip key under a versioned name. */
const ENV_ALIASES: Record<string, string[]> = {
  INFOBIP_API_KEY: ["INFOBIP_API_KEY", "INFOBIP_API_KEY_V2", "INFOBIP_API_KEY_V3"],
};

function readEnv(key: string): string {
  for (const name of ENV_ALIASES[key] ?? [key]) {
    const v = process.env[name];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

function mask(value: string): string {
  if (!value) return "";
  return value.length > 8 ? `••••••••${value.slice(-4)}` : "••••";
}

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  // user_roles queried directly: has_role() is not callable by `authenticated`.
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("This area is restricted to the system administrator.");
}

const MIGRATION_HINT =
  "Saved keys aren't set up yet — run the integration_credentials SQL in the Lovable SQL editor, then try again.";

// ---------- overview ----------

export type IntegrationFieldStatus = {
  key: string;
  label: string;
  secret: boolean;
  optional: boolean;
  help?: string;
  defaultValue?: string;
  /** There is an effective value (saved in the screen or a server secret). */
  isSet: boolean;
  source: "screen" | "server" | "none";
  /** Plain value for non-secret settings, masked (last 4) for secrets, empty when unset. */
  display: string;
  /** Saved in the screen but not applied to the running server. */
  inactive: boolean;
};

export type IntegrationStatus = {
  id: string;
  editable: boolean;
  testable: boolean;
  hasSaved: boolean;
  undecryptable: boolean;
  fields: IntegrationFieldStatus[];
};

export type IntegrationsOverview = {
  providers: IntegrationStatus[];
  vault: { configured: boolean; source: "screen" | "server" | "none" };
  /** The migration has been run. */
  storageReady: boolean;
  /** Set when saved keys could not be loaded or applied. */
  problem?: string;
};

export const listIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationsOverview> => {
    await assertSuperAdmin(context as any);
    const env = await import("@/lib/integration-env.server");
    const store = await import("@/lib/integration-store.server");

    await env.applyIntegrationOverlay(true);
    const overlay = env.getOverlayStatus();
    const vault = await store.vaultStatus();

    let saved = new Map<string, Awaited<ReturnType<typeof store.readAllCredentials>>[number]>();
    if (overlay.storageReady) {
      try {
        saved = new Map((await store.readAllCredentials()).map((r) => [r.provider, r]));
      } catch (e) {
        if (store.isMissingTable(e)) overlay.storageReady = false;
      }
    }

    const providers: IntegrationStatus[] = INTEGRATION_PROVIDERS.map((p) => {
      const row = saved.get(p.id);
      return {
        id: p.id,
        editable: p.editable,
        testable: Boolean(p.testable),
        hasSaved: Boolean(row && (Object.keys(row.config).length || Object.keys(row.secrets).length)),
        undecryptable: Boolean(row?.undecryptable),
        fields: p.fields.map((f) => {
          const savedValue = ((f.secret ? row?.secrets[f.key] : row?.config[f.key]) ?? "").trim();
          const effective = readEnv(f.key);
          const source = savedValue ? "screen" : env.serverSecretValue(f.key) ? "server" : "none";
          return {
            key: f.key,
            label: f.label,
            secret: f.secret,
            optional: Boolean(f.optional),
            ...(f.help ? { help: f.help } : {}),
            ...(f.defaultValue ? { defaultValue: f.defaultValue } : {}),
            isSet: Boolean(effective),
            source,
            display: f.secret ? mask(effective) : effective,
            inactive: Boolean(savedValue) && effective !== savedValue,
          };
        }),
      };
    });

    const problem = !overlay.storageReady
      ? undefined
      : overlay.error
        ? overlay.error
        : overlay.assignFailed.length
          ? `Saved values for ${overlay.assignFailed.join(", ")} couldn't be applied to the running server.`
          : undefined;

    return { providers, vault, storageReady: overlay.storageReady, ...(problem ? { problem } : {}) };
  });

// ---------- save / remove ----------

const saveInput = z.object({
  provider: z.string().min(1).max(64),
  /** Non-secret settings the admin touched. Empty string = go back to the server value. */
  config: z.record(z.string(), z.string().max(2000)).default({}),
  /** Secrets the admin typed. Blank is ignored (keeps what's saved). */
  secrets: z.record(z.string(), z.string().max(4000)).default({}),
  /** Saved values to forget. */
  clear: z.array(z.string()).default([]),
});

function requireEditable(providerId: string): IntegrationProvider {
  const spec = providerById(providerId);
  if (!spec) throw new Error("Unknown app");
  if (!spec.editable) throw new Error(`${spec.name} is set in Lovable Cloud › Secrets and can't be changed here.`);
  return spec;
}

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as any);
    const spec = requireEditable(data.provider);
    const store = await import("@/lib/integration-store.server");
    const env = await import("@/lib/integration-env.server");

    try {
      const current = (await store.readCredential(spec.id)) ?? { config: {}, secrets: {}, undecryptable: false };
      const config = { ...current.config };
      const secrets = { ...current.secrets };
      const fieldByKey = new Map(spec.fields.map((f) => [f.key, f]));

      for (const key of data.clear) {
        delete config[key];
        delete secrets[key];
      }
      for (const [key, raw] of Object.entries(data.config)) {
        const field = fieldByKey.get(key);
        if (!field || field.secret) continue;
        const value = raw.trim();
        if (value) config[key] = value;
        else delete config[key];
      }
      for (const [key, raw] of Object.entries(data.secrets)) {
        const field = fieldByKey.get(key);
        if (!field?.secret) continue;
        const value = raw.trim();
        if (value) secrets[key] = value;
      }
      // Drop anything no longer in the catalogue.
      for (const key of Object.keys(config)) if (!fieldByKey.has(key)) delete config[key];
      for (const key of Object.keys(secrets)) if (!fieldByKey.get(key)?.secret) delete secrets[key];

      await store.writeCredential(spec.id, config, secrets, (context as any).userId);
    } catch (e) {
      if (store.isMissingTable(e)) throw new Error(MIGRATION_HINT);
      throw e;
    }

    env.invalidateIntegrationEnv();
    await env.applyIntegrationOverlay(true);
    return { ok: true };
  });

export const removeIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as any);
    const spec = requireEditable(data.provider);
    const store = await import("@/lib/integration-store.server");
    const env = await import("@/lib/integration-env.server");
    try {
      await store.writeCredential(spec.id, {}, {}, (context as any).userId);
    } catch (e) {
      if (store.isMissingTable(e)) throw new Error(MIGRATION_HINT);
      throw e;
    }
    env.invalidateIntegrationEnv();
    await env.applyIntegrationOverlay(true);
    return { ok: true };
  });

// ---------- vault password + reveal ----------

export const setIntegrationsVaultPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ password: z.string().min(1).max(500), current: z.string().max(500).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as any);
    const store = await import("@/lib/integration-store.server");
    try {
      await store.setVaultPassword(data.password, data.current);
    } catch (e) {
      if (store.isMissingTable(e)) throw new Error(MIGRATION_HINT);
      // Slow down wrong "current password" guesses a little.
      if (/Incorrect vault password/.test((e as Error).message)) await new Promise((r) => setTimeout(r, 750));
      throw e;
    }
    console.log("[integrations] vault password set", { who: String((context as any).userId).slice(-6) });
    return { ok: true };
  });

/**
 * Returns the full secret values for one app. Gated behind the vault password,
 * and fails closed: with no vault password set, nothing can be revealed.
 * Attempts are logged without any values.
 */
export const revealIntegrationSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ provider: z.string().min(1).max(64), vaultPassword: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    await assertSuperAdmin(context as any);
    const spec = providerById(data.provider);
    if (!spec) throw new Error("Unknown app");
    const store = await import("@/lib/integration-store.server");
    const env = await import("@/lib/integration-env.server");
    const who = String((context as any).userId ?? "").slice(-6);

    try {
      await store.verifyVaultPassword(data.vaultPassword);
    } catch (e) {
      console.log("[integrations] reveal attempt", { provider: spec.id, who, ok: false });
      if (/Incorrect vault password/.test((e as Error).message)) {
        // Slow guessing down a little; the worker is stateless so no lockout.
        await new Promise((r) => setTimeout(r, 750));
      }
      throw e;
    }
    console.log("[integrations] reveal attempt", { provider: spec.id, who, ok: true });

    await env.applyIntegrationOverlay();
    const out: Record<string, string> = {};
    for (const f of spec.fields.filter((x) => x.secret)) out[f.key] = readEnv(f.key);
    return out;
  });

// ---------- test connection ----------

export type TestResult = {
  ok: boolean;
  message: string;
  detail?: string;
  reason?: "no_credits" | "bad_key" | "rate_limited" | "not_configured" | "unreachable" | "rejected";
  topUpUrl?: string;
};

function fromHttp(name: string, status: number, body: string, billingUrl?: string): TestResult {
  const detail = body.trim().slice(0, 300) || undefined;
  const base = { ...(detail ? { detail } : {}), ...(billingUrl ? { topUpUrl: billingUrl } : {}) };
  if (status === 401 || status === 403)
    return { ok: false, reason: "bad_key", message: `${name} rejected the key. Check it and try again.`, ...base };
  if (status === 402 || /insufficient_quota|exceeded your current quota|out of credit|no credit/i.test(body))
    return { ok: false, reason: "no_credits", message: `${name} says there is no credit left. Top up ${name} to continue.`, ...base };
  if (status === 429)
    return { ok: false, reason: "rate_limited", message: `${name} is limiting requests right now. Try again in a minute.`, ...base };
  return { ok: false, reason: "rejected", message: `${name} replied with HTTP ${status}.`, ...base };
}

async function probeOpenAi(spec: IntegrationProvider): Promise<TestResult> {
  const { OPENAI_BASE, openAiHeaders, openAiKey, openAiModels } = await import("@/lib/openai.server");
  if (!openAiKey()) return { ok: false, reason: "not_configured", message: "No OpenAI API key is set yet." };

  const list = await fetch(`${OPENAI_BASE}/models`, { headers: openAiHeaders() });
  if (!list.ok) return fromHttp(spec.name, list.status, await list.text(), spec.billingUrl);
  const ids = new Set(((await list.json()) as any)?.data?.map((m: any) => String(m.id)) ?? []);

  const models = openAiModels();
  const missing = (Object.entries(models) as Array<[string, string]>)
    .filter(([, id]) => !ids.has(id))
    .map(([slot, id]) => `${slot}: ${id}`);

  // Listing models is free and works with no credit, so make one tiny request to
  // catch an empty balance as well.
  const ping = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: openAiHeaders(),
    body: JSON.stringify({
      model: models.fast,
      messages: [{ role: "user", content: "Reply with OK." }],
      max_completion_tokens: 32,
    }),
  });
  if (!ping.ok && !missing.some((m) => m.startsWith("fast:"))) {
    return fromHttp(spec.name, ping.status, await ping.text(), spec.billingUrl);
  }
  if (missing.length) {
    return {
      ok: false,
      reason: "rejected",
      message: `Key accepted, but these models aren't available on this OpenAI account: ${missing.join("; ")}. Change them above.`,
    };
  }
  return { ok: true, message: "OpenAI accepted the key, all four models are available and a live request worked." };
}

async function probe(spec: IntegrationProvider): Promise<TestResult> {
  switch (spec.id) {
    case "openai":
      return probeOpenAi(spec);
    case "infobip": {
      const { checkInfobipAuth } = await import("@/lib/whatsapp-infobip.server");
      const r = await checkInfobipAuth();
      if (r.ok) return { ok: true, message: "Infobip accepted the key and the sender list loaded." };
      return fromHttp(spec.name, r.status || 0, r.error ?? "");
    }
    case "serper": {
      const key = readEnv("SERPER_API_KEY");
      if (!key) return { ok: false, reason: "not_configured", message: "No Serper API key is set yet." };
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: "connection test", num: 1 }),
      });
      return res.ok ? { ok: true, message: "Serper accepted the key — a live search worked." } : fromHttp(spec.name, res.status, await res.text());
    }
    case "paypal": {
      const id = readEnv("PAYPAL_CLIENT_ID");
      const secret = readEnv("PAYPAL_CLIENT_SECRET");
      if (!id || !secret) return { ok: false, reason: "not_configured", message: "PayPal client ID and secret aren't both set yet." };
      const live = (readEnv("PAYPAL_ENV") || "sandbox").toLowerCase() === "live";
      const res = await fetch(`https://api-m${live ? "" : ".sandbox"}.paypal.com/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      return res.ok
        ? { ok: true, message: `PayPal accepted the credentials (${live ? "live" : "sandbox"}).` }
        : fromHttp(spec.name, res.status, await res.text());
    }
    default:
      return { ok: false, reason: "not_configured", message: "No automatic test is available for this app." };
  }
}

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }): Promise<TestResult> => {
    await assertSuperAdmin(context as any);
    const spec = providerById(data.provider);
    if (!spec) throw new Error("Unknown app");
    const env = await import("@/lib/integration-env.server");
    await env.applyIntegrationOverlay(true);
    try {
      return await probe(spec);
    } catch (e) {
      return { ok: false, reason: "unreachable", message: `Couldn't reach ${spec.name}.`, detail: (e as Error).message };
    }
  });
