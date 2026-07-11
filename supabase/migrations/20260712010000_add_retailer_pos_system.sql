ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS pos_system text;
