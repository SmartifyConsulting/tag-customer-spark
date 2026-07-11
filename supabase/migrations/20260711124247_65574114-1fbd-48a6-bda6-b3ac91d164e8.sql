
-- Configurable Taxonomy Engine
CREATE TABLE public.taxonomy_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retailer_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taxonomy_profiles TO authenticated;
GRANT ALL ON public.taxonomy_profiles TO service_role;
ALTER TABLE public.taxonomy_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view retailer taxonomy profiles"
  ON public.taxonomy_profiles FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY "Managers can manage retailer taxonomy profiles"
  ON public.taxonomy_profiles FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.taxonomy_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.taxonomy_profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  attribute_key TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taxonomy_levels TO authenticated;
GRANT ALL ON public.taxonomy_levels TO service_role;
ALTER TABLE public.taxonomy_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view retailer taxonomy levels"
  ON public.taxonomy_levels FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.taxonomy_profiles p
    WHERE p.id = profile_id AND public.belongs_to_retailer(auth.uid(), p.retailer_id)
  ));
CREATE POLICY "Managers can manage retailer taxonomy levels"
  ON public.taxonomy_levels FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.taxonomy_profiles p
    WHERE p.id = profile_id AND public.can_manage_retailer(auth.uid(), p.retailer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.taxonomy_profiles p
    WHERE p.id = profile_id AND public.can_manage_retailer(auth.uid(), p.retailer_id)
  ));

CREATE TRIGGER update_taxonomy_profiles_updated_at
  BEFORE UPDATE ON public.taxonomy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Only one default per retailer
CREATE OR REPLACE FUNCTION public.tg_taxonomy_single_default()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.taxonomy_profiles
      SET is_default = FALSE
      WHERE retailer_id = NEW.retailer_id AND id <> NEW.id AND is_default = TRUE;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER taxonomy_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.taxonomy_profiles
  FOR EACH ROW WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION public.tg_taxonomy_single_default();

CREATE INDEX idx_taxonomy_profiles_retailer ON public.taxonomy_profiles(retailer_id);
CREATE INDEX idx_taxonomy_levels_profile ON public.taxonomy_levels(profile_id, position);
