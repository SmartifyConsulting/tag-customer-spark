DROP INDEX IF EXISTS public.product_qr_assets_active_gtin_uidx;
CREATE UNIQUE INDEX product_qr_assets_active_gtin_uidx
  ON public.product_qr_assets (retailer_id, gtin)
  WHERE status = 'active';