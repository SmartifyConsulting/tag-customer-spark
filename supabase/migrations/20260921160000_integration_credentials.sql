-- Saved integration keys (Admin > Integrations) and the vault behind Reveal.
--
-- Both tables are readable and writable ONLY by the server (service role).
-- Row level security is on with no policies, and all access is revoked from the
-- browser-facing roles, so the API can never return these rows to a client.

-- One row per integration. `config` holds non-secret settings (URLs, model
-- names, environments); `secrets_encrypted` is an AES-GCM payload
-- ("v1.<iv>.<ciphertext>") holding that integration's secret values.
create table if not exists public.integration_credentials (
  provider          text primary key,
  config            jsonb not null default '{}'::jsonb,
  secrets_encrypted text,
  updated_by        uuid,
  updated_at        timestamptz not null default now()
);

-- Single-row vault settings: the hash of the Reveal password and, unless an
-- INTEGRATION_ENCRYPTION_KEY server secret is set, the key used to encrypt the
-- values above.
create table if not exists public.integration_vault (
  id            boolean primary key default true check (id),
  password_salt text,
  password_hash text,
  data_key      text,
  updated_at    timestamptz not null default now()
);

alter table public.integration_credentials enable row level security;
alter table public.integration_vault enable row level security;

revoke all on public.integration_credentials from anon, authenticated;
revoke all on public.integration_vault from anon, authenticated;

grant all on public.integration_credentials to service_role;
grant all on public.integration_vault to service_role;
