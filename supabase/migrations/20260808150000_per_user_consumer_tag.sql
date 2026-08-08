-- Every shopper gets their own consumer TAG ID at signup, tied to their
-- auth user directly — not a shared "demo household" tag. Previously
-- consumer_tag_ids only linked to a retailer (staff/counter concept); there
-- was no column at all for "this is Jane's personal tag."

ALTER TABLE public.consumer_tag_ids
  ALTER COLUMN retailer_id DROP NOT NULL;

ALTER TABLE public.consumer_tag_ids
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.consumer_tag_ids
  ADD CONSTRAINT consumer_tag_ids_user_id_key UNIQUE (user_id);

-- Shoppers can read their own tag directly (existing policies only allow
-- staff to read tags belonging to their retailer).
CREATE POLICY "consumer_tag_ids_select_own" ON public.consumer_tag_ids
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Generates a TAG-XXXX-YYNN id in the same shape the app's randomTagId() produces.
CREATE OR REPLACE FUNCTION public.generate_tag_id()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'TAG-' || lpad(floor(1000 + random() * 9000)::int::text, 4, '0') || '-' ||
    (ARRAY['AB','CD','EF','GH','JK','LM','NP','QR','ST','UV','WX','YZ'])[1 + floor(random() * 12)::int] ||
    floor(10 + random() * 89)::int::text;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Default new users to sales_assistant; admins can elevate later
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'sales_assistant')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Every new user (shopper or staff) gets their own personal TAG ID,
  -- identified only by their email — no retailer association required.
  INSERT INTO public.consumer_tag_ids (user_id, tag_id, display_name)
  VALUES (NEW.id, public.generate_tag_id(), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill existing accounts that predate this migration.
INSERT INTO public.consumer_tag_ids (user_id, tag_id, display_name)
SELECT u.id, public.generate_tag_id(), u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.consumer_tag_ids c WHERE c.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
