CREATE OR REPLACE FUNCTION public.enqueue_intent_recompute(_product_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.intent_recompute_queue(product_id)
  VALUES (_product_id)
  ON CONFLICT (product_id) DO UPDATE SET enqueued_at = now();
$function$;

REVOKE EXECUTE ON FUNCTION public.enqueue_intent_recompute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_intent_recompute(uuid) TO authenticated, service_role;