
-- product-images: path = {retailer_id}/{product_id}/{file}
CREATE POLICY product_images_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY retailer_logos_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'retailer-logos'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'retailer-logos'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
