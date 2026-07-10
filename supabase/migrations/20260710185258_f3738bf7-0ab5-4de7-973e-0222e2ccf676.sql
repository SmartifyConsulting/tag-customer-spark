
-- 1. Add DPP id column to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS digital_product_passport_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS products_dpp_id_key ON public.products(digital_product_passport_id);

-- 2. Add resolver_url to qr assets
ALTER TABLE public.product_qr_assets
  ADD COLUMN IF NOT EXISTS resolver_url text;

-- 3. product_passports
CREATE TABLE IF NOT EXISTS public.product_passports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  dpp_id uuid NOT NULL UNIQUE,
  gtin text,

  brand text,
  manufacturer text,
  country_of_origin text,
  category_path text,

  short_description text,
  marketing_description text,
  product_summary text,
  consumer_faqs jsonb NOT NULL DEFAULT '[]'::jsonb,

  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  nutrition jsonb NOT NULL DEFAULT '{}'::jsonb,
  allergens text[] NOT NULL DEFAULT '{}',

  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,

  warranty jsonb NOT NULL DEFAULT '{}'::jsonb,
  sustainability jsonb NOT NULL DEFAULT '{}'::jsonb,

  images jsonb NOT NULL DEFAULT '[]'::jsonb,

  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  enrichment_status text NOT NULL DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending','enriching','enriched','failed','manual')),
  enrichment_model text,
  enriched_at timestamptz,
  version int NOT NULL DEFAULT 1,
  last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_passports_retailer_idx ON public.product_passports(retailer_id);
CREATE INDEX IF NOT EXISTS product_passports_status_idx ON public.product_passports(enrichment_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_passports TO authenticated;
GRANT SELECT ON public.product_passports TO anon;
GRANT ALL ON public.product_passports TO service_role;

ALTER TABLE public.product_passports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passports_retailer_read" ON public.product_passports
  FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "passports_retailer_write" ON public.product_passports
  FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE POLICY "passports_public_read" ON public.product_passports
  FOR SELECT TO anon
  USING (enrichment_status IN ('enriched','manual'));

CREATE TRIGGER product_passports_updated_at
  BEFORE UPDATE ON public.product_passports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Enrichment queue
CREATE TABLE IF NOT EXISTS public.passport_enrichment_queue (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS passport_queue_enqueued_idx ON public.passport_enrichment_queue(enqueued_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passport_enrichment_queue TO authenticated;
GRANT ALL ON public.passport_enrichment_queue TO service_role;

ALTER TABLE public.passport_enrichment_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "passport_queue_retailer" ON public.passport_enrichment_queue
  FOR ALL TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

-- 5. Backfill: enqueue existing products
INSERT INTO public.passport_enrichment_queue (product_id, retailer_id)
SELECT p.id, p.retailer_id FROM public.products p
WHERE p.status = 'active'
ON CONFLICT (product_id) DO NOTHING;
