
-- product_passports extensions
ALTER TABLE public.product_passports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS hero_image text,
  ADD COLUMN IF NOT EXISTS thumbnail text,
  ADD COLUMN IF NOT EXISTS image_gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS storage_instructions text,
  ADD COLUMN IF NOT EXISTS preparation_instructions text,
  ADD COLUMN IF NOT EXISTS recycling jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- products extensions
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS hero_image text,
  ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS image_source text,
  ADD COLUMN IF NOT EXISTS image_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS image_gallery jsonb NOT NULL DEFAULT '[]'::jsonb;

-- qr_scans extensions (all nullable — Digital Link scans have limited context)
ALTER TABLE public.qr_scans
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

ALTER TABLE public.qr_scans ALTER COLUMN qr_tag_id DROP NOT NULL;

-- Public read policies (safe columns must be enforced in the query — RLS gates rows only)
DROP POLICY IF EXISTS "public_read_products_active" ON public.products;
CREATE POLICY "public_read_products_active" ON public.products
  FOR SELECT TO anon
  USING (status = 'active');

DROP POLICY IF EXISTS "public_read_passports_published" ON public.product_passports;
CREATE POLICY "public_read_passports_published" ON public.product_passports
  FOR SELECT TO anon
  USING (status = 'published' AND visibility = 'public');

DROP POLICY IF EXISTS "public_read_qr_active" ON public.product_qr_assets;
CREATE POLICY "public_read_qr_active" ON public.product_qr_assets
  FOR SELECT TO anon
  USING (status = 'active');

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_passports TO anon;
GRANT SELECT ON public.product_qr_assets TO anon;
