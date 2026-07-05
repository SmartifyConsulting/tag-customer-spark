DROP POLICY IF EXISTS al_insert ON public.audit_logs;
CREATE POLICY al_insert ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (retailer_id IS NOT NULL AND belongs_to_retailer(auth.uid(), retailer_id));