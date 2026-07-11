
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS normalised_brand text,
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS size_value numeric,
  ADD COLUMN IF NOT EXISTS size_unit text,
  ADD COLUMN IF NOT EXISTS pack_count int,
  ADD COLUMN IF NOT EXISTS normalised_at timestamptz,
  ADD COLUMN IF NOT EXISTS normalisation_payload jsonb;

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES public.retailers(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  logo_path text,
  logo_url text,
  website text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT SELECT ON public.brands TO anon;
GRANT ALL ON public.brands TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select_public" ON public.brands FOR SELECT USING (true);
CREATE POLICY "brands_insert_retailer" ON public.brands FOR INSERT TO authenticated
  WITH CHECK (retailer_id IS NULL OR public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY "brands_update_retailer" ON public.brands FOR UPDATE TO authenticated
  USING (retailer_id IS NULL OR public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY "brands_delete_retailer" ON public.brands FOR DELETE TO authenticated
  USING (retailer_id IS NULL OR public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);
