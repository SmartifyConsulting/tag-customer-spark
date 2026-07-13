
-- 1. product_passports: drop overly permissive anon read
DROP POLICY IF EXISTS passports_public_read ON public.product_passports;

-- 2. product_qr_assets: drop broad anon read (public resolver uses service role)
DROP POLICY IF EXISTS public_read_qr_active ON public.product_qr_assets;

-- 3. brands: restrict SELECT to authenticated tenant members
DROP POLICY IF EXISTS brands_select_public ON public.brands;
CREATE POLICY brands_select_authenticated ON public.brands
  FOR SELECT TO authenticated
  USING (retailer_id IS NULL OR belongs_to_retailer(auth.uid(), retailer_id));

-- 4. SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated where not needed
REVOKE EXECUTE ON FUNCTION public.apply_paid_tier(uuid, tag_tier, text, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_conversation_message_after_insert() FROM PUBLIC, anon, authenticated;
