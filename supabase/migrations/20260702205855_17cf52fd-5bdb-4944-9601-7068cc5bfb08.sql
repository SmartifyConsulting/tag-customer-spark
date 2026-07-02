ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text;