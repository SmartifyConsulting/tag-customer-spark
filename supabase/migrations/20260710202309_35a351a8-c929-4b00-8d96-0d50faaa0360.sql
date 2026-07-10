
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS suggested_category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_confidence numeric;

CREATE INDEX IF NOT EXISTS idx_products_suggested_category ON public.products(suggested_category_id);
