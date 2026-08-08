-- Global, app-wide feature toggles controlled by a single system administrator
-- (not per-retailer — this is a platform-level kill switch, distinct from the
-- existing per-workspace tier/feature-gating system in tier.ts).

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Every signed-in user can read the flags (needed to hide/show UI), but only
-- the single named system administrator's account can change them.
CREATE POLICY "system_settings_select" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_settings_insert" ON public.system_settings
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'georgia.adams@smartify.co.za');

CREATE POLICY "system_settings_update" ON public.system_settings
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'georgia.adams@smartify.co.za')
  WITH CHECK ((auth.jwt() ->> 'email') = 'georgia.adams@smartify.co.za');

INSERT INTO public.system_settings (key, value) VALUES ('receipts_enabled', true)
ON CONFLICT (key) DO NOTHING;
