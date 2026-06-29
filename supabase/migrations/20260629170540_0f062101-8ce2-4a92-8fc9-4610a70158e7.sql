
-- Extend products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS sale_price_cents integer,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promotion_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS promotion_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_retailer_status ON public.products(retailer_id, status);
CREATE INDEX IF NOT EXISTS idx_products_retailer_name ON public.products(retailer_id, name);
CREATE INDEX IF NOT EXISTS idx_products_retailer_sku ON public.products(retailer_id, sku);

-- Extend retailers with logo
ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Extend qr_tags
ALTER TABLE public.qr_tags
  ADD COLUMN IF NOT EXISTS short_code text,
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regenerated_from uuid REFERENCES public.qr_tags(id) ON DELETE SET NULL;

-- backfill short_code from code if null
UPDATE public.qr_tags SET short_code = code WHERE short_code IS NULL;
ALTER TABLE public.qr_tags ALTER COLUMN short_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_tags_short_code ON public.qr_tags(short_code);
CREATE INDEX IF NOT EXISTS idx_qr_tags_product_active ON public.qr_tags(product_id, is_active);

-- qr_scans table
CREATE TABLE IF NOT EXISTS public.qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_tag_id uuid NOT NULL REFERENCES public.qr_tags(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  device_type text,
  user_agent text,
  ip_hash text,
  referrer text,
  qr_version integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qr_scans TO authenticated;
GRANT INSERT ON public.qr_scans TO anon, authenticated;
GRANT ALL ON public.qr_scans TO service_role;

ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY qr_scans_select ON public.qr_scans FOR SELECT
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY qr_scans_insert_public ON public.qr_scans FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qr_scans_retailer_time ON public.qr_scans(retailer_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scans_product_time ON public.qr_scans(product_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scans_qr ON public.qr_scans(qr_tag_id);

-- Public read of qr_tags by short_code for scan resolution
DROP POLICY IF EXISTS qr_tags_public_lookup ON public.qr_tags;
CREATE POLICY qr_tags_public_lookup ON public.qr_tags FOR SELECT
  TO anon
  USING (is_active = true);
GRANT SELECT ON public.qr_tags TO anon;
