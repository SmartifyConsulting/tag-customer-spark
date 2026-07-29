-- 1. Move SECURITY DEFINER role check out of the exposed API schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- public.has_role becomes a thin SECURITY INVOKER wrapper (policies + RPC keep working)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Public buckets: keep direct-link reads, block bucket listing via the Data API
DROP POLICY IF EXISTS public_read_product_images ON storage.objects;
DROP POLICY IF EXISTS public_read_retailer_logos ON storage.objects;
DROP POLICY IF EXISTS public_read_qr_artifacts ON storage.objects;
DROP POLICY IF EXISTS public_read_brand_logos ON storage.objects;
DROP POLICY IF EXISTS public_read_category_images ON storage.objects;

-- 3. Customers: only managers/admins may create customer PII rows
DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

-- 4. Conversation messages: internal notes restricted to managers/admins
DROP POLICY IF EXISTS cm_insert ON public.conversation_messages;
CREATE POLICY cm_insert ON public.conversation_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_retailer(auth.uid(), retailer_id)
    AND (
      is_internal = false
      OR public.can_manage_retailer(auth.uid(), retailer_id)
    )
  );

-- 5. Sales leads: allow super admins to manage
CREATE POLICY sales_leads_update_super ON public.sales_leads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY sales_leads_delete_super ON public.sales_leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));