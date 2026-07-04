create extension if not exists pg_trgm;

alter table public.products
  add column if not exists search_blob text
  generated always as (
    lower(regexp_replace(coalesce(name,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(brand,''), '\s+', '', 'g'))
  ) stored;

create index if not exists products_search_blob_trgm
  on public.products using gin (search_blob gin_trgm_ops);