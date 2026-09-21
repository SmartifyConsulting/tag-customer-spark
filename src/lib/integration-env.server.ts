// Makes keys saved in Admin > Integrations visible to the rest of the app.
//
// The code reads settings straight from process.env (64 reads in 30 files), so
// instead of rewriting each one, saved values are copied into process.env at
// the start of each request (see start.ts). A saved value overrides a server
// secret; removing it restores the server secret. Only settings in the
// integrations catalogue can ever be set, and results are cached for a minute.

import { editableFieldKeys, providerById } from "@/lib/integrations.catalog";
import { isMissingTable, readAllCredentials } from "@/lib/integration-store.server";

const TTL_MS = 60_000;

export type OverlayStatus = {
  /** The last refresh finished without error. */
  ok: boolean;
  /** The migration has been run (both tables exist). */
  storageReady: boolean;
  error?: string;
  /** Keys currently taken from saved values. */
  applied: string[];
  /** A saved value could not be written into the running environment. */
  assignFailed: string[];
};

let loadedAt = 0;
let inflight: Promise<void> | null = null;
let status: OverlayStatus = { ok: true, storageReady: true, applied: [], assignFailed: [] };

/** Server-secret values as they were before anything was overridden. */
const originals = new Map<string, string | undefined>();
const applied = new Set<string>();

function snapshotOriginals() {
  for (const key of editableFieldKeys()) {
    if (!originals.has(key)) originals.set(key, process.env[key]);
  }
}

/** The value set in Lovable Cloud › Secrets, ignoring anything saved in the screen. */
export function serverSecretValue(key: string): string {
  snapshotOriginals();
  return (originals.get(key) ?? "").trim();
}

export function getOverlayStatus(): OverlayStatus {
  return status;
}

/** Forget the cache so the next request reloads (called after a save). */
export function invalidateIntegrationEnv() {
  loadedAt = 0;
}

async function refresh(): Promise<void> {
  snapshotOriginals();
  const target = new Map<string, string>();
  try {
    const rows = await readAllCredentials();
    const allowed = editableFieldKeys();
    for (const row of rows) {
      const spec = providerById(row.provider);
      if (!spec?.editable) continue;
      for (const field of spec.fields) {
        if (!allowed.has(field.key)) continue;
        const value = (field.secret ? row.secrets[field.key] : row.config[field.key]) ?? "";
        if (value.trim()) target.set(field.key, value.trim());
      }
    }
  } catch (e) {
    status = {
      ...status,
      ok: false,
      storageReady: !isMissingTable(e),
      error: (e as any)?.message ?? "Could not load saved integration keys.",
    };
    return;
  }

  // Put back server secrets for anything that is no longer overridden.
  for (const key of Array.from(applied)) {
    if (target.has(key)) continue;
    const original = originals.get(key);
    try {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    } catch {
      /* environment is read-only here; nothing more to do */
    }
    applied.delete(key);
  }

  const assignFailed: string[] = [];
  for (const [key, value] of target) {
    try {
      process.env[key] = value;
      if (process.env[key] === value) applied.add(key);
      else assignFailed.push(key);
    } catch {
      assignFailed.push(key);
    }
  }
  status = { ok: true, storageReady: true, applied: Array.from(applied), assignFailed };
}

/** Loads saved values into process.env. Cheap when the cache is fresh. */
export async function applyIntegrationOverlay(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  if (!inflight) {
    inflight = refresh()
      .catch(() => {})
      .finally(() => {
        // Cache failures too, so a missing table doesn't cost a query per request.
        loadedAt = Date.now();
        inflight = null;
      });
  }
  await inflight;
}
