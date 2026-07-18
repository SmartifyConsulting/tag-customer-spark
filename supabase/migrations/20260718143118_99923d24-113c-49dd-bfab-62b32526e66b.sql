
-- conversation_messages
DROP POLICY IF EXISTS cm_write ON public.conversation_messages;
CREATE POLICY cm_insert ON public.conversation_messages FOR INSERT TO authenticated
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY cm_modify ON public.conversation_messages FOR UPDATE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));
CREATE POLICY cm_delete ON public.conversation_messages FOR DELETE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id));

-- conversations
DROP POLICY IF EXISTS conv_write ON public.conversations;
CREATE POLICY conv_insert ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY conv_update ON public.conversations FOR UPDATE TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY conv_delete ON public.conversations FOR DELETE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id));

-- customers
DROP POLICY IF EXISTS customers_write ON public.customers;
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id));

-- customer_interests
DROP POLICY IF EXISTS ci_write ON public.customer_interests;
CREATE POLICY ci_manage ON public.customer_interests FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

-- customer_phone_opt_ins (store-scoped)
DROP POLICY IF EXISTS customer_phone_opt_ins_tenant_all ON public.customer_phone_opt_ins;
CREATE POLICY cpoi_select ON public.customer_phone_opt_ins FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = customer_phone_opt_ins.store_id
      AND public.belongs_to_retailer(auth.uid(), s.retailer_id)
  ));
CREATE POLICY cpoi_manage ON public.customer_phone_opt_ins FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = customer_phone_opt_ins.store_id
      AND public.can_manage_retailer(auth.uid(), s.retailer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = customer_phone_opt_ins.store_id
      AND public.can_manage_retailer(auth.uid(), s.retailer_id)
  ));

-- roi_attributions
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='roi_attributions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.roi_attributions', r.policyname);
  END LOOP;
END $$;
CREATE POLICY roi_attr_select ON public.roi_attributions FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY roi_attr_manage ON public.roi_attributions FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

-- watchlist_events
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='watchlist_events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.watchlist_events', r.policyname);
  END LOOP;
END $$;
CREATE POLICY we_select ON public.watchlist_events FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY we_manage ON public.watchlist_events FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

-- watchlists
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='watchlists' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.watchlists', r.policyname);
  END LOOP;
END $$;
CREATE POLICY wl_select ON public.watchlists FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY wl_manage ON public.watchlists FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

-- whatsapp_messages
DROP POLICY IF EXISTS whatsapp_messages_tenant_all ON public.whatsapp_messages;
CREATE POLICY wam_select ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = whatsapp_messages.store_id
      AND public.belongs_to_retailer(auth.uid(), s.retailer_id)
  ));
CREATE POLICY wam_manage ON public.whatsapp_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = whatsapp_messages.store_id
      AND public.can_manage_retailer(auth.uid(), s.retailer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = whatsapp_messages.store_id
      AND public.can_manage_retailer(auth.uid(), s.retailer_id)
  ));
