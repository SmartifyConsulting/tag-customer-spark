-- Custom (user-defined) taxonomy levels: products carry an arbitrary
-- key/value bag, and retailers can pre-declare known values for a custom
-- level the same way they pre-declare categories/brands before any product
-- is tagged with them.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.taxonomy_attribute_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retailer_id UUID NOT NULL,
  attribute_key TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(retailer_id, attribute_key, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taxonomy_attribute_values TO authenticated;
GRANT ALL ON public.taxonomy_attribute_values TO service_role;
ALTER TABLE public.taxonomy_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view retailer attribute values"
  ON public.taxonomy_attribute_values FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY "Managers can manage retailer attribute values"
  ON public.taxonomy_attribute_values FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE INDEX idx_taxonomy_attribute_values_retailer ON public.taxonomy_attribute_values(retailer_id, attribute_key);
CREATE INDEX idx_products_custom_attributes ON public.products USING GIN (custom_attributes);
