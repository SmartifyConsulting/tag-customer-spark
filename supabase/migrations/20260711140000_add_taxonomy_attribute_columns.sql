-- Flat attribute columns for the Product Taxonomy Engine, matching the
-- existing pattern used by size/color/variant.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS range_name text,
  ADD COLUMN IF NOT EXISTS collection text,
  ADD COLUMN IF NOT EXISTS season text;
