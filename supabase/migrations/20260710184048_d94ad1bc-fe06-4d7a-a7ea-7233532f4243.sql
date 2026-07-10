
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS gtin TEXT,
  ADD COLUMN IF NOT EXISTS barcode_type TEXT,
  ADD COLUMN IF NOT EXISTS digital_link_url TEXT;

CREATE INDEX IF NOT EXISTS idx_products_retailer_gtin ON public.products(retailer_id, gtin);

CREATE TABLE IF NOT EXISTS public.product_qr_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  gtin TEXT,
  digital_link_url TEXT NOT NULL,
  png_path TEXT,
  svg_path TEXT,
  pdf_path TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_qr_assets TO authenticated;
GRANT ALL ON public.product_qr_assets TO service_role;

ALTER TABLE public.product_qr_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_assets_retailer_read"
  ON public.product_qr_assets FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "qr_assets_retailer_manage"
  ON public.product_qr_assets FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));
