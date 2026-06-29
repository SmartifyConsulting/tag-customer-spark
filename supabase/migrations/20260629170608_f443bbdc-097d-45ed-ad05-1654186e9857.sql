
DROP POLICY IF EXISTS qr_scans_insert_public ON public.qr_scans;
REVOKE INSERT ON public.qr_scans FROM anon, authenticated;
-- service_role retains ALL via earlier grant; the public scan endpoint uses supabaseAdmin
