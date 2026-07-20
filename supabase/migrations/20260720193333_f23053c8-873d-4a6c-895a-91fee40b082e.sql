
-- Add store attribution to QR assets
ALTER TABLE public.product_qr_assets
  ADD COLUMN IF NOT EXISTS store_id uuid NULL REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_name text NULL;

-- Add denormalised store_name to qr_scans (store_id already exists)
ALTER TABLE public.qr_scans
  ADD COLUMN IF NOT EXISTS store_name text NULL;

-- Backfill store_name where we already know store_id
UPDATE public.qr_scans qs
SET store_name = s.name
FROM public.stores s
WHERE qs.store_id = s.id
  AND qs.store_name IS NULL;

-- Replace the retailer+gtin-only uniqueness with retailer+gtin+store so a product
-- can have one active QR per branch (nullable store treated as a single slot).
DROP INDEX IF EXISTS public.product_qr_assets_active_gtin_uidx;
CREATE UNIQUE INDEX product_qr_assets_active_gtin_store_uidx
  ON public.product_qr_assets (retailer_id, gtin, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'active';
