
-- Brands: remove NULL-retailer bypass so tenants can't touch shared rows
DROP POLICY IF EXISTS brands_select_authenticated ON public.brands;
DROP POLICY IF EXISTS brands_insert_retailer ON public.brands;
DROP POLICY IF EXISTS brands_update_retailer ON public.brands;
DROP POLICY IF EXISTS brands_delete_retailer ON public.brands;

CREATE POLICY brands_select_authenticated ON public.brands
  FOR SELECT TO authenticated
  USING (
    retailer_id IS NOT NULL
    AND belongs_to_retailer(auth.uid(), retailer_id)
  );

CREATE POLICY brands_insert_retailer ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (
    retailer_id IS NOT NULL
    AND belongs_to_retailer(auth.uid(), retailer_id)
  );

CREATE POLICY brands_update_retailer ON public.brands
  FOR UPDATE TO authenticated
  USING (
    retailer_id IS NOT NULL
    AND belongs_to_retailer(auth.uid(), retailer_id)
  )
  WITH CHECK (
    retailer_id IS NOT NULL
    AND belongs_to_retailer(auth.uid(), retailer_id)
  );

CREATE POLICY brands_delete_retailer ON public.brands
  FOR DELETE TO authenticated
  USING (
    retailer_id IS NOT NULL
    AND can_manage_retailer(auth.uid(), retailer_id)
  );

-- Super admins can still manage global (retailer_id IS NULL) brands
CREATE POLICY brands_super_admin_all ON public.brands
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- complete_signup: accept explicit user_id, revoke from authenticated, run via service role
CREATE OR REPLACE FUNCTION public.complete_signup(
  p_name text DEFAULT NULL,
  p_billing_country text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_country_name text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_email text;
  v_meta jsonb;
  v_invite public.staff%ROWTYPE;
  v_retailer_id uuid;
  v_slug text;
  v_name text;
  v_billing_country text;
  v_currency text;
  v_country_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND retailer_id IS NOT NULL) THEN
    SELECT retailer_id INTO v_retailer_id FROM public.user_roles WHERE user_id = v_user_id AND retailer_id IS NOT NULL LIMIT 1;
    RETURN v_retailer_id;
  END IF;

  SELECT email, raw_user_meta_data INTO v_email, v_meta FROM auth.users WHERE id = v_user_id;

  v_name := coalesce(nullif(trim(p_name), ''), v_meta->>'company_name');
  v_billing_country := coalesce(p_billing_country, v_meta->>'billing_country', 'ZA');
  v_currency := coalesce(p_currency, v_meta->>'currency', 'ZAR');
  v_country_name := coalesce(p_country_name, v_meta->>'country_name', 'South Africa');

  SELECT * INTO v_invite FROM public.staff
    WHERE invite_email = v_email AND status = 'invited' AND user_id IS NULL
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.staff SET user_id = v_user_id, status = 'active' WHERE id = v_invite.id;
    UPDATE public.user_roles SET retailer_id = v_invite.retailer_id, role = v_invite.role WHERE user_id = v_user_id;
    RETURN v_invite.retailer_id;
  END IF;

  v_name := coalesce(nullif(trim(v_name), ''), 'My workspace');
  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.retailers (name, slug, billing_country, currency, created_by)
  VALUES (v_name, v_slug, v_billing_country, v_currency, v_user_id)
  RETURNING id INTO v_retailer_id;

  UPDATE public.user_roles SET retailer_id = v_retailer_id, role = 'retail_admin' WHERE user_id = v_user_id;

  INSERT INTO public.stores (retailer_id, name, country, created_by)
  VALUES (v_retailer_id, v_name, v_country_name, v_user_id);

  RETURN v_retailer_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.complete_signup(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_signup(text, text, text, text, uuid) TO service_role;
