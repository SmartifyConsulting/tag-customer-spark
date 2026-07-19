
CREATE OR REPLACE FUNCTION public.mark_onboarding_complete(p_user_id uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_retailer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT retailer_id INTO v_retailer_id
    FROM public.user_roles
    WHERE user_id = v_user_id AND retailer_id IS NOT NULL
    LIMIT 1;
  IF v_retailer_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.retailers
    SET onboarding_completed_at = now()
    WHERE id = v_retailer_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_onboarding_complete(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_onboarding_complete(uuid) TO service_role;
