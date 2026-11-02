-- Token ledger insights.

-- 1) Keep WHY a call failed (the provider's own message), and which bulk action
-- or background job a call belonged to, so the ledger can explain failures and
-- show what one button press cost.
-- Also records which user triggered the call (a snapshot of their name, so the
-- ledger still reads correctly if they are renamed or removed). Calls made by
-- background jobs have no user.
alter table public.ai_usage_events
  add column if not exists error_message text,
  add column if not exists run_label     text,
  add column if not exists user_id       uuid,
  add column if not exists user_name     text;

-- 2) Monthly budget for the ledger's progress bar and warning emails.
-- One row only; read and written by the server (service role), never the browser.
create table if not exists public.ledger_settings (
  id                 boolean       primary key default true check (id),
  monthly_budget_usd numeric(10,2),
  alert_at_percent   integer       not null default 80 check (alert_at_percent between 1 and 100),
  updated_at         timestamptz   not null default now()
);

alter table public.ledger_settings enable row level security;
revoke all on public.ledger_settings from anon, authenticated;
grant all on public.ledger_settings to service_role;
