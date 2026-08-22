DROP POLICY IF EXISTS "nh_write" ON public.notification_history;
CREATE POLICY "nh_write" ON public.notification_history FOR ALL TO authenticated
  USING (can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (can_manage_retailer(auth.uid(), retailer_id));

DROP POLICY IF EXISTS "rc_write" ON public.redemption_codes;
CREATE POLICY "rc_write" ON public.redemption_codes FOR ALL TO authenticated
  USING (can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (can_manage_retailer(auth.uid(), retailer_id));

DROP POLICY IF EXISTS "Authenticated users can view outlets" ON public.outlets;
CREATE POLICY "Outlets visible to their retailer" ON public.outlets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = outlets.store_id
      AND belongs_to_retailer(auth.uid(), s.retailer_id)
  ));

DROP POLICY IF EXISTS "retailer_logos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "retailer_logos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "retailer_logos_auth_delete" ON storage.objects;