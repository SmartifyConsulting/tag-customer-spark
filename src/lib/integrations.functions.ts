import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INTEGRATION_PROVIDERS, providerById } from "@/lib/integrations.catalog";

// Read-only view of TAG's integrations. Values come from the server
// environment (Lovable Cloud › Secrets); nothing is stored or changed here.
// Only super admins can call these, and a secret leaves the server in full
// only through revealIntegrationSecrets, behind the vault password.

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

export type IntegrationFieldStatus = {
  key: string;
  label: string;
  secret: boolean;
  optional: boolean;
  help?: string;
  isSet: boolean;
  /** Plain value for non-secret settings, masked (last 4) for secrets, empty when unset. */
  display: string;
};

export type IntegrationStatus = {
  id: string;
  fields: IntegrationFieldStatus[];
};

export type IntegrationsOverview = {
  providers: IntegrationStatus[];
  /** Whether a vault password has been set; without one nothing can be revealed. */
  vaultConfigured: boolean;
};

export const listIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationsOverview> => {
    await assertSuperAdmin(context as any);
    const providers: IntegrationStatus[] = INTEGRATION_PROVIDERS.map((p) => ({
      id: p.id,
      fields: p.fields.map((f) => {
        const value = readEnv(f.key);
        return {
          key: f.key,
          label: f.label,
          secret: f.secret,
          optional: Boolean(f.optional),
          ...(f.help ? { help: f.help } : {}),
          isSet: Boolean(value),
          display: f.secret ? mask(value) : value,
        };
      }),
    }));
    return { providers, vaultConfigured: Boolean(process.env["INTEGRATIONS_VAULT_PASSWORD"]) };
  });

async function sha256(value: string): Promise<Buffer> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(value).digest();
}

/**
 * Returns the full secret values for one app. Gated behind a vault password
 * (INTEGRATIONS_VAULT_PASSWORD) that is separate from anyone's login, and
 * fails closed: with no vault password configured, nothing can be revealed.
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

    const who = String((context as any).userId ?? "").slice(-6);
    const expected = process.env["INTEGRATIONS_VAULT_PASSWORD"];
    if (!expected) {
      console.warn("[integrations] reveal refused: no vault password configured", { provider: spec.id, who });
      throw new Error(
        "No vault password is configured (INTEGRATIONS_VAULT_PASSWORD) — nothing can be revealed until an administrator sets one.",
      );
    }

    const { timingSafeEqual } = await import("crypto");
    const ok = timingSafeEqual(await sha256(data.vaultPassword), await sha256(expected));
    console.log("[integrations] reveal attempt", { provider: spec.id, who, ok });
    if (!ok) {
      // Slow guessing down a little; the worker is stateless so no lockout.
      await new Promise((r) => setTimeout(r, 750));
      throw new Error("Incorrect vault password.");
    }

    const out: Record<string, string> = {};
    for (const f of spec.fields.filter((x) => x.secret)) out[f.key] = readEnv(f.key);
    return out;
  });
