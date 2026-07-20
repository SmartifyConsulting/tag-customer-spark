
-- 1. Remove anonymous read access to products and product_passports.
-- Public routes (/passport/:gtin, /p/:dppId, /api/public/*) already use the
-- server-side admin client, so anon direct-table reads are no longer needed.
DROP POLICY IF EXISTS public_read_products_active ON public.products;
DROP POLICY IF EXISTS public_read_passports_published ON public.product_passports;
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_passports FROM anon;

-- 2. Tighten customer DELETE — only retail_admin or super_admin, not
-- store_manager, can hard-delete customer PII.
DROP POLICY IF EXISTS customers_delete ON public.customers;
CREATE POLICY customers_delete ON public.customers
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.belongs_to_retailer(auth.uid(), retailer_id)
      AND public.has_role(auth.uid(), 'retail_admin')
    )
  );

-- 3. Explicit SELECT policies for public storage buckets so read intent is
-- documented in RLS rather than implied by the bucket public flag.
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "public_read_qr_artifacts" ON storage.objects;
CREATE POLICY "public_read_qr_artifacts" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'qr-artifacts');

DROP POLICY IF EXISTS "public_read_retailer_logos" ON storage.objects;
CREATE POLICY "public_read_retailer_logos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'retailer-logos');

DROP POLICY IF EXISTS "public_read_brand_logos" ON storage.objects;
CREATE POLICY "public_read_brand_logos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'brand-logos');

DROP POLICY IF EXISTS "public_read_category_images" ON storage.objects;
CREATE POLICY "public_read_category_images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'category-images');
