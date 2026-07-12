ALTER TABLE public.taxonomy_levels
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
