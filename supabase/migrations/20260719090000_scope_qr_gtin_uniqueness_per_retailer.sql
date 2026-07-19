-- The same manufacturer GTIN is legitimately imported by multiple retailers
-- (e.g. several appliance retailers all stocking "Defy 323L Bottom Freezer").
-- A platform-wide unique index on (gtin) meant only the first retailer to
-- generate a QR/resolver for that GTIN could ever succeed — every other
-- retailer stocking the same product permanently failed QR generation.
-- Scope uniqueness to (gtin, retailer_id) so each retailer can have their
-- own active QR/resolver for a shared GTIN.
DROP INDEX IF EXISTS public.product_qr_assets_active_gtin_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS product_qr_assets_active_gtin_retailer_uidx
  ON public.product_qr_assets (gtin, retailer_id)
  WHERE status = 'active';
