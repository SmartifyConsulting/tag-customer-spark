DROP POLICY IF EXISTS "intent queue managers can enqueue" ON public.intent_recompute_queue;
DROP POLICY IF EXISTS "intent queue managers can refresh enqueue" ON public.intent_recompute_queue;

CREATE POLICY "intent queue managers can enqueue"
ON public.intent_recompute_queue
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = intent_recompute_queue.product_id
      AND public.can_manage_retailer(auth.uid(), p.retailer_id)
  )
);

CREATE POLICY "intent queue managers can refresh enqueue"
ON public.intent_recompute_queue
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = intent_recompute_queue.product_id
      AND public.can_manage_retailer(auth.uid(), p.retailer_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = intent_recompute_queue.product_id
      AND public.can_manage_retailer(auth.uid(), p.retailer_id)
  )
);