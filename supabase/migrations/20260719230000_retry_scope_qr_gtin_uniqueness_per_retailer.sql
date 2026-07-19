-- Retry of 20260719090000_scope_qr_gtin_uniqueness_per_retailer.sql.
-- That migration was pushed and shows as applied in history, but a QR
-- generation attempt today still hit the *old* constraint name
-- ("product_qr_assets_active_gtin_uidx") in its error message — direct,
-- live proof the DROP/CREATE never actually took effect in the database,
-- despite the app-code side of that same fix (qr.functions.ts's clash
-- check) working correctly. Re-running is safe either way: both
-- statements are idempotent (IF EXISTS / IF NOT EXISTS).
DROP INDEX IF EXISTS public.product_qr_assets_active_gtin_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS product_qr_assets_active_gtin_retailer_uidx
  ON public.product_qr_assets (gtin, retailer_id)
  WHERE status = 'active';
