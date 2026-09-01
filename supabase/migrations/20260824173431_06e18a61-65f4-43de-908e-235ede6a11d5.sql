DROP POLICY IF EXISTS consumer_tag_ids_insert ON public.consumer_tag_ids;
CREATE POLICY consumer_tag_ids_insert ON public.consumer_tag_ids
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

DROP POLICY IF EXISTS sales_leads_insert_own ON public.sales_leads;
CREATE POLICY sales_leads_insert_own ON public.sales_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND (retailer_id IS NULL OR public.belongs_to_retailer(auth.uid(), retailer_id))
  );