
-- 1. Restrict qr_scans SELECT to authenticated role
DROP POLICY IF EXISTS qr_scans_select ON public.qr_scans;
CREATE POLICY qr_scans_select ON public.qr_scans
  FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

-- 2. Add retailer ownership check to qr_artifacts_manage and split SELECT out to prevent listing
DROP POLICY IF EXISTS qr_artifacts_manage ON storage.objects;
CREATE POLICY qr_artifacts_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qr-artifacts'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY qr_artifacts_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'qr-artifacts'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'qr-artifacts'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY qr_artifacts_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'qr-artifacts'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY qr_artifacts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'qr-artifacts'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

-- 3. Restrict listing on product-images and retailer-logos buckets (public URLs still work via storage CDN).
-- Convert the existing FOR ALL policies (which grant listing to any authenticated user) into per-op policies
-- that scope SELECT to the owning retailer path.
DROP POLICY IF EXISTS product_images_write ON storage.objects;
CREATE POLICY product_images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY product_images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY product_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY product_images_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS retailer_logos_write ON storage.objects;
CREATE POLICY retailer_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'retailer-logos'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY retailer_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'retailer-logos'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'retailer-logos'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY retailer_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'retailer-logos'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
CREATE POLICY retailer_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'retailer-logos'
    AND public.can_manage_retailer(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

-- 4. Add explicit tenant-scoped policies for customer_phone_opt_ins and whatsapp_messages
-- (both had RLS enabled but no policies — fail-closed. Make intent explicit and functional for owning retailer staff.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_phone_opt_ins TO authenticated;
GRANT ALL ON public.customer_phone_opt_ins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

CREATE POLICY customer_phone_opt_ins_tenant_all ON public.customer_phone_opt_ins
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = customer_phone_opt_ins.store_id
        AND public.belongs_to_retailer(auth.uid(), s.retailer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = customer_phone_opt_ins.store_id
        AND public.belongs_to_retailer(auth.uid(), s.retailer_id)
    )
  );

CREATE POLICY whatsapp_messages_tenant_all ON public.whatsapp_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = whatsapp_messages.store_id
        AND public.belongs_to_retailer(auth.uid(), s.retailer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = whatsapp_messages.store_id
        AND public.belongs_to_retailer(auth.uid(), s.retailer_id)
    )
  );
