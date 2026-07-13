-- Real tenant provisioning on signup, plus invite-acceptance, plus a
-- retailer-level currency for international support.
--
-- Today `handle_new_user()` only creates a `profiles` row and a
-- `user_roles` row with `retailer_id = NULL` — nothing ever assigns a new
-- signup to a retailer. `complete_signup` closes that gap: called once by
-- the client right after `supabase.auth.signUp`, it either (a) attaches the
-- caller to a retailer they were already invited to (matched by
-- `staff.invite_email`), or (b) provisions a brand-new retailer + default
-- store for them as the owner (`retail_admin`).

ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ZAR';

CREATE OR REPLACE FUNCTION public.complete_signup(
  p_name text,
  p_billing_country text DEFAULT 'ZA',
  p_currency text DEFAULT 'ZAR',
  p_country_name text DEFAULT 'South Africa'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.staff%ROWTYPE;
  v_retailer_id uuid;
  v_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Already provisioned? Don't double-assign.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND retailer_id IS NOT NULL) THEN
    SELECT retailer_id INTO v_retailer_id FROM public.user_roles WHERE user_id = v_user_id AND retailer_id IS NOT NULL LIMIT 1;
    RETURN v_retailer_id;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Pending staff invite for this email? Attach to that retailer instead of
  -- creating a new one.
  SELECT * INTO v_invite FROM public.staff
    WHERE invite_email = v_email AND status = 'invited' AND user_id IS NULL
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.staff SET user_id = v_user_id, status = 'active' WHERE id = v_invite.id;
    UPDATE public.user_roles SET retailer_id = v_invite.retailer_id, role = v_invite.role WHERE user_id = v_user_id;
    RETURN v_invite.retailer_id;
  END IF;

  -- Otherwise provision a brand-new retailer with the caller as owner.
  v_slug := lower(regexp_replace(coalesce(nullif(trim(p_name), ''), 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.retailers (name, slug, billing_country, currency, created_by)
  VALUES (coalesce(nullif(trim(p_name), ''), 'My workspace'), v_slug, p_billing_country, p_currency, v_user_id)
  RETURNING id INTO v_retailer_id;

  UPDATE public.user_roles SET retailer_id = v_retailer_id, role = 'retail_admin' WHERE user_id = v_user_id;

  INSERT INTO public.stores (retailer_id, name, country, created_by)
  VALUES (v_retailer_id, coalesce(nullif(trim(p_name), ''), 'Main store'), p_country_name, v_user_id);

  RETURN v_retailer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_signup(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_signup(text, text, text, text) TO authenticated;
