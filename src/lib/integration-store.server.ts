// Server-only storage for keys entered in Admin > Integrations.
//
// - Values live in `integration_credentials`, secrets AES-GCM encrypted.
// - The encryption key is INTEGRATION_ENCRYPTION_KEY if that server secret is
//   set; otherwise a random key generated on first use and kept in
//   `integration_vault`. The second case hides saved keys from anyone browsing
//   tables, exports or logs, but it is stored beside the data, so it does not
//   protect against someone with full database access.
// - Reveal is gated by a vault password, stored only as a salted PBKDF2 hash
//   (or, until one is set in the screen, INTEGRATIONS_VAULT_PASSWORD).
// Both tables are service-role only (see the migration).

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// ---------- small byte helpers ----------

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A fresh ArrayBuffer copy, which is what Web Crypto wants regardless of TS lib version. */
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** True when a Supabase error means the migration hasn't been run yet. */
export function isMissingTable(err: unknown): boolean {
  const e = err as any;
  const text = `${e?.message ?? ""} ${e?.code ?? ""}`;
  return /42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(text);
}

// ---------- encryption key ----------

async function dataKeyBytes(): Promise<Uint8Array> {
  const fromEnv = (process.env["INTEGRATION_ENCRYPTION_KEY"] ?? "").trim();
  if (fromEnv) return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fromEnv)));

  const client = await db();
  const read = async () => {
    const { data, error } = await client.from("integration_vault").select("data_key").eq("id", true).maybeSingle();
    if (error) throw error;
    return (data?.data_key as string | null) ?? null;
  };
  const existing = await read();
  if (existing) return fromB64(existing);

  const fresh = toB64(crypto.getRandomValues(new Uint8Array(32)));
  // Race-safe: whichever request writes first wins, everyone re-reads.
  const ins = await client.from("integration_vault").insert({ id: true, data_key: fresh });
  if (ins.error) {
    // Row already exists (e.g. created by setting the password) — fill the key only if empty.
    await client.from("integration_vault").update({ data_key: fresh }).eq("id", true).is("data_key", null);
  }
  const stored = await read();
  if (!stored) throw new Error("Could not create the encryption key.");
  return fromB64(stored);
}

async function aesKey() {
  return crypto.subtle.importKey("raw", buf(await dataKeyBytes()), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecrets(secrets: Record<string, string>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buf(iv) },
      await aesKey(),
      buf(new TextEncoder().encode(JSON.stringify(secrets))),
    ),
  );
  return `v1.${toB64(iv)}.${toB64(cipher)}`;
}

/** Returns null when the payload can't be decrypted (e.g. the key changed). */
export async function decryptSecrets(payload: string | null): Promise<Record<string, string> | null> {
  if (!payload) return {};
  const [version, ivPart, cipherPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buf(fromB64(ivPart)) },
      await aesKey(),
      buf(fromB64(cipherPart)),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>;
  } catch {
    return null;
  }
}

// ---------- credential rows ----------

export type StoredCredential = {
  provider: string;
  config: Record<string, string>;
  secrets: Record<string, string>;
  /** Secrets exist but couldn't be decrypted with the current key. */
  undecryptable: boolean;
};

async function toStored(row: any): Promise<StoredCredential> {
  const secrets = await decryptSecrets((row.secrets_encrypted as string | null) ?? null);
  return {
    provider: row.provider as string,
    config: (row.config ?? {}) as Record<string, string>,
    secrets: secrets ?? {},
    undecryptable: secrets === null,
  };
}

export async function readAllCredentials(): Promise<StoredCredential[]> {
  const { data, error } = await (await db()).from("integration_credentials").select("*");
  if (error) throw error;
  return Promise.all((data ?? []).map(toStored));
}

export async function readCredential(provider: string): Promise<StoredCredential | null> {
  const { data, error } = await (await db())
    .from("integration_credentials")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  return data ? toStored(data) : null;
}

/** Saves one integration's values; removes the row when nothing is left. */
export async function writeCredential(
  provider: string,
  config: Record<string, string>,
  secrets: Record<string, string>,
  userId: string,
): Promise<void> {
  const client = await db();
  if (Object.keys(config).length === 0 && Object.keys(secrets).length === 0) {
    const { error } = await client.from("integration_credentials").delete().eq("provider", provider);
    if (error) throw error;
    return;
  }
  const { error } = await client.from("integration_credentials").upsert(
    {
      provider,
      config,
      secrets_encrypted: Object.keys(secrets).length ? await encryptSecrets(secrets) : null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );
  if (error) throw error;
}

// ---------- vault password ----------

const PBKDF2_ITERATIONS = 120_000;
export const MIN_VAULT_PASSWORD = 10;

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(new TextEncoder().encode(password)), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function safeEqual(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  const { timingSafeEqual } = await import("crypto");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type VaultStatus = { configured: boolean; source: "screen" | "server" | "none" };

export async function vaultStatus(): Promise<VaultStatus> {
  try {
    const { data } = await (await db())
      .from("integration_vault")
      .select("password_hash")
      .eq("id", true)
      .maybeSingle();
    if (data?.password_hash) return { configured: true, source: "screen" };
  } catch {
    /* table missing — fall through to the server secret */
  }
  if ((process.env["INTEGRATIONS_VAULT_PASSWORD"] ?? "").length > 0) return { configured: true, source: "server" };
  return { configured: false, source: "none" };
}

/** Throws unless `password` is the vault password. Fails closed when none is set. */
export async function verifyVaultPassword(password: string): Promise<void> {
  let row: any = null;
  try {
    const { data } = await (await db())
      .from("integration_vault")
      .select("password_hash, password_salt")
      .eq("id", true)
      .maybeSingle();
    row = data;
  } catch {
    row = null;
  }

  if (row?.password_hash && row?.password_salt) {
    const derived = await pbkdf2(password, fromB64(row.password_salt));
    if (await safeEqual(derived, fromB64(row.password_hash))) return;
    throw new Error("Incorrect vault password.");
  }

  const fromEnv = process.env["INTEGRATIONS_VAULT_PASSWORD"] ?? "";
  if (!fromEnv) {
    throw new Error("No vault password is set yet — set one on the Integrations tab first.");
  }
  if (await safeEqual(await sha256(password), await sha256(fromEnv))) return;
  throw new Error("Incorrect vault password.");
}

/** Sets or changes the vault password. Changing requires the current one. */
export async function setVaultPassword(next: string, current: string | undefined): Promise<void> {
  if (next.length < MIN_VAULT_PASSWORD) {
    throw new Error(`Use at least ${MIN_VAULT_PASSWORD} characters for the vault password.`);
  }
  const status = await vaultStatus();
  if (status.configured) {
    if (!current) throw new Error("Enter the current vault password to change it.");
    await verifyVaultPassword(current);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(next, salt);
  const client = await db();
  const patch = { password_salt: toB64(salt), password_hash: toB64(hash), updated_at: new Date().toISOString() };
  const upd = await client.from("integration_vault").update(patch).eq("id", true).select("id");
  if (upd.error) throw upd.error;
  if (!upd.data || upd.data.length === 0) {
    const ins = await client.from("integration_vault").insert({ id: true, ...patch });
    if (ins.error) throw ins.error;
  }
}
