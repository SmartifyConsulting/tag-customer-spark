
-- Restrict anon public column exposure via column-level GRANTs.
-- products: revoke full SELECT for anon, then grant only consumer-facing columns.
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, retailer_id, store_id, category_id, brand_id,
  name, display_name, description, brand, normalised_brand,
  color, size, variant, size_value, size_unit, pack_count,
  gtin, barcode_type, digital_link_url, digital_product_passport_id,
  price_cents, sale_price_cents, currency,
  on_promotion, promotion_label, promotion_start_date, promotion_end_date,
  image_url, thumbnail_url, hero_image, image_gallery, images, image_status,
  status, qr_status,
  stock_qty,
  created_at, updated_at
) ON public.products TO anon;

-- product_passports: revoke full SELECT for anon, then grant only consumer-facing columns.
REVOKE SELECT ON public.product_passports FROM anon;
GRANT SELECT (
  id, product_id, retailer_id, dpp_id, gtin,
  brand, manufacturer, country_of_origin, category_path,
  short_description, marketing_description, product_summary, consumer_faqs,
  ingredients, nutrition, allergens,
  dimensions, materials, warranty, sustainability, recycling,
  storage_instructions, preparation_instructions,
  images, hero_image, thumbnail, image_gallery,
  keywords, translations, seo_meta,
  status, visibility,
  created_at, updated_at
) ON public.product_passports TO anon;

-- Storage write policies for brand-logos and category-images buckets.
-- Uploads currently happen via service role, so scope managed writes to super admins.
DROP POLICY IF EXISTS "brand_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "brand_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "brand_logos_delete" ON storage.objects;
DROP POLICY IF EXISTS "category_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "category_images_update" ON storage.objects;
DROP POLICY IF EXISTS "category_images_delete" ON storage.objects;

CREATE POLICY "brand_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-logos' AND public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "brand_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-logos' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'brand-logos' AND public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "brand_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'brand-logos' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "category_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "category_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "category_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'super_admin'));
