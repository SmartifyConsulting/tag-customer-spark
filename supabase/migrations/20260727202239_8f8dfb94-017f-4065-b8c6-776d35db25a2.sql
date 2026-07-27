ALTER FUNCTION public.tg_enqueue_intent_from_product() SECURITY DEFINER;
ALTER FUNCTION public.tg_enqueue_intent_from_scan() SECURITY DEFINER;
ALTER FUNCTION public.tg_enqueue_intent_from_interest() SECURITY DEFINER;
ALTER FUNCTION public.tg_enqueue_intent_from_recovery() SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.enqueue_intent_recompute(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_intent_recompute(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.tg_enqueue_intent_from_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_enqueue_intent_from_scan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_enqueue_intent_from_interest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_enqueue_intent_from_recovery() FROM PUBLIC, anon, authenticated;