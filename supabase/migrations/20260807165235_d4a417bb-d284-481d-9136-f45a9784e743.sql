DROP INDEX IF EXISTS public.products_search_blob_trgm;
DROP EXTENSION IF EXISTS pg_net;
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX products_search_blob_trgm ON public.products USING gin (search_blob extensions.gin_trgm_ops);