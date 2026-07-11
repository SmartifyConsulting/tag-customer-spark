-- More flat attribute columns for the Product Taxonomy Engine, matching the
-- existing pattern used by size/color/variant/supplier/range_name.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_family text,
  ADD COLUMN IF NOT EXISTS style text;
