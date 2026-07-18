-- Manually provisions a confirmed, ready-to-use account for Jenny McCann,
-- bypassing the normal signup email/confirmation flow.
--
-- BEFORE RUNNING:
--   1. Replace EMAIL_PLACEHOLDER and PASSWORD_PLACEHOLDER below with real
--      values. Use a strong temporary password — tell Jenny to change it
--      on first login (Settings > Change password), or trigger Supabase's
--      "send password reset" for her afterward instead of sharing it.
--   2. This creates her as the OWNER of a brand-new retailer/workspace
--      (role = retail_admin), the same as a normal self-serve signup.
--      If instead she should join an EXISTING retailer's team, don't run
--      this script — invite her from Admin > Users in the app instead,
--      which attaches her to that retailer with the role you pick there.
--   3. Run this in the Supabase SQL Editor (or via `supabase db execute`),
--      connected to your project's database.

do $$
declare
  v_email      text := 'EMAIL_PLACEHOLDER';       -- e.g. 'jenny.mccann@example.com'
  v_password   text := 'PASSWORD_PLACEHOLDER';    -- e.g. a strong temp password
  v_full_name  text := 'Jenny McCann';
  v_user_id    uuid;
  v_retailer_id uuid;
  v_slug       text;
begin
  create extension if not exists pgcrypto;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'A user with email % already exists — aborting.', v_email;
  end if;

  -- Create the auth user directly, pre-confirmed (no confirmation email
  -- sent, no magic-link round trip needed).
  v_user_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', v_full_name),
    now(), now(), '', '', '', ''
  );

  -- handle_new_user() (trigger on auth.users) fires automatically here,
  -- creating her profiles row and a default user_roles row.

  -- Provision her own retailer + main store, mirroring complete_signup()'s
  -- "brand-new owner" path.
  v_slug := lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.retailers (name, slug, billing_country, currency, created_by)
  values (v_full_name || '''s workspace', v_slug, 'ZA', 'ZAR', v_user_id)
  returning id into v_retailer_id;

  delete from public.user_roles where user_id = v_user_id;
  insert into public.user_roles (user_id, role, retailer_id)
  values (v_user_id, 'retail_admin', v_retailer_id);

  insert into public.stores (retailer_id, name, country, created_by)
  values (v_retailer_id, 'Main store', 'South Africa', v_user_id);

  raise notice 'Created user % (id %) with retailer % (id %)', v_email, v_user_id, v_full_name, v_retailer_id;
end $$;
