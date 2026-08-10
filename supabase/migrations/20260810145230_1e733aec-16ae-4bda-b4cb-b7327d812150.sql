DROP POLICY IF EXISTS "Anyone can view outlets" ON public.outlets;

CREATE POLICY "Authenticated users can view outlets"
  ON public.outlets FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.outlets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlets TO authenticated;
GRANT ALL ON public.outlets TO service_role;