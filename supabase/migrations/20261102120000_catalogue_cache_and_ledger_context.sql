-- 1) "Nothing found" memory for the shared catalogue.
-- When a web image search for a barcode completes and finds nothing usable,
-- remember that for 30 days (the code enforces the window) so the same paid
-- search isn't repeated on every page load / backfill pass.
create table if not exists public.catalogue_misses (
  gtin       text        not null,
  kind       text        not null,
  checked_at timestamptz not null default now(),
  primary key (gtin, kind)
);

alter table public.catalogue_misses enable row level security;
revoke all on public.catalogue_misses from anon, authenticated;
grant all on public.catalogue_misses to service_role;

-- 2) Say which product / store each AI or search call was for.
-- product_id and retailer_id already exist on this table; names are stored as
-- a snapshot so the ledger still reads correctly after a product is renamed or
-- deleted. Rows written before this change keep these columns empty.
alter table public.ai_usage_events
  add column if not exists store_id      uuid,
  add column if not exists product_name  text,
  add column if not exists store_name    text,
  add column if not exists retailer_name text;

create index if not exists ai_usage_events_product_idx
  on public.ai_usage_events (product_id)
  where product_id is not null;
