
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS retailer_id uuid;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_retailer_uidx
  ON public.user_roles (user_id, role, COALESCE(retailer_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TYPE public.retailer_status AS ENUM ('active','suspended','cancelled');
CREATE TYPE public.store_status AS ENUM ('active','closed','pending');
CREATE TYPE public.staff_status AS ENUM ('active','invited','disabled');
CREATE TYPE public.category_status AS ENUM ('active','archived');
CREATE TYPE public.product_status AS ENUM ('active','draft','archived');
CREATE TYPE public.qr_status AS ENUM ('active','inactive','retired');
CREATE TYPE public.customer_status AS ENUM ('subscribed','unsubscribed','blocked');
CREATE TYPE public.interest_status AS ENUM ('active','notified','converted','expired');
CREATE TYPE public.campaign_type AS ENUM ('sale','low_stock','back_in_stock','promotion');
CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','sending','sent','cancelled');
CREATE TYPE public.notification_status AS ENUM ('queued','sent','delivered','read','failed');
CREATE TYPE public.conversation_status AS ENUM ('open','closed','archived');
CREATE TYPE public.message_direction AS ENUM ('inbound','outbound');
CREATE TYPE public.message_status AS ENUM ('sent','delivered','read','failed');
CREATE TYPE public.promotion_status AS ENUM ('scheduled','active','ended','cancelled');
CREATE TYPE public.redemption_status AS ENUM ('issued','redeemed','expired','void');
CREATE TYPE public.recovery_status AS ENUM ('attributed','pending','rejected');
CREATE TYPE public.audit_status AS ENUM ('success','warning','failure');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','cancelled');

CREATE OR REPLACE FUNCTION public.belongs_to_retailer(_user_id uuid, _retailer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND retailer_id = _retailer_id)
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.can_manage_retailer(_user_id uuid, _retailer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND retailer_id = _retailer_id AND role IN ('retail_admin','store_manager')
  ) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

REVOKE EXECUTE ON FUNCTION public.belongs_to_retailer(uuid,uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_retailer(uuid,uuid) FROM public, anon;

CREATE TABLE public.retailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, contact_email text,
  plan text NOT NULL DEFAULT 'starter',
  status public.retailer_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retailers TO authenticated;
GRANT ALL ON public.retailers TO service_role;
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;
CREATE POLICY retailers_select ON public.retailers FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), id));
CREATE POLICY retailers_insert ON public.retailers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY retailers_update ON public.retailers FOR UPDATE TO authenticated USING (public.can_manage_retailer(auth.uid(), id)) WITH CHECK (public.can_manage_retailer(auth.uid(), id));
CREATE POLICY retailers_delete ON public.retailers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  name text NOT NULL, address text, city text, country text,
  timezone text NOT NULL DEFAULT 'UTC',
  status public.store_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY stores_select ON public.stores FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY stores_write ON public.stores FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_email text, full_name text,
  role public.app_role NOT NULL DEFAULT 'sales_assistant',
  status public.staff_status NOT NULL DEFAULT 'invited',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY staff_write ON public.staff FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  status public.category_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcat_select ON public.product_categories FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY pcat_write ON public.product_categories FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  sku text NOT NULL, name text NOT NULL, description text,
  price_cents integer NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'ZAR',
  stock_qty integer NOT NULL DEFAULT 0, low_stock_threshold integer NOT NULL DEFAULT 5,
  image_url text,
  status public.product_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, sku)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY products_write ON public.products FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.qr_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  scan_count integer NOT NULL DEFAULT 0, last_scanned_at timestamptz,
  status public.qr_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_tags TO authenticated;
GRANT ALL ON public.qr_tags TO service_role;
ALTER TABLE public.qr_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr_select ON public.qr_tags FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY qr_write ON public.qr_tags FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  whatsapp_e164 text NOT NULL, full_name text, locale text NOT NULL DEFAULT 'en',
  opted_in_at timestamptz NOT NULL DEFAULT now(),
  status public.customer_status NOT NULL DEFAULT 'subscribed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, whatsapp_e164)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY customers_write ON public.customers FOR ALL TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id)) WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TABLE public.customer_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qr_tag_id uuid REFERENCES public.qr_tags(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'qr_scan',
  status public.interest_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_interests TO authenticated;
GRANT ALL ON public.customer_interests TO service_role;
ALTER TABLE public.customer_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ci_select ON public.customer_interests FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY ci_write ON public.customer_interests FOR ALL TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id)) WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TABLE public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  type public.campaign_type NOT NULL, title text NOT NULL, message_template text NOT NULL,
  scheduled_at timestamptz, sent_at timestamptz,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_campaigns TO authenticated;
GRANT ALL ON public.notification_campaigns TO service_role;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY nc_select ON public.notification_campaigns FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY nc_write ON public.notification_campaigns FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.notification_campaigns(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz, delivered_at timestamptz, read_at timestamptz, error text,
  status public.notification_status NOT NULL DEFAULT 'queued',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_history TO authenticated;
GRANT ALL ON public.notification_history TO service_role;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY nh_select ON public.notification_history FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY nh_write ON public.notification_history FOR ALL TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id)) WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  status public.conversation_status NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_select ON public.conversations FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY conv_write ON public.conversations FOR ALL TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id)) WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction public.message_direction NOT NULL,
  body text, media_url text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status public.message_status NOT NULL DEFAULT 'sent',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY cm_select ON public.conversation_messages FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY cm_write ON public.conversation_messages FOR ALL TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id)) WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TABLE public.promotion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL, discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
  status public.promotion_status NOT NULL DEFAULT 'scheduled',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_events TO authenticated;
GRANT ALL ON public.promotion_events TO service_role;
ALTER TABLE public.promotion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pe_select ON public.promotion_events FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY pe_write ON public.promotion_events FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  promotion_id uuid REFERENCES public.promotion_events(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  redeemed_at timestamptz, expires_at timestamptz,
  status public.redemption_status NOT NULL DEFAULT 'issued',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.redemption_codes TO authenticated;
GRANT ALL ON public.redemption_codes TO service_role;
ALTER TABLE public.redemption_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_select ON public.redemption_codes FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY rc_write ON public.redemption_codes FOR ALL TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id)) WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TABLE public.sales_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.notification_history(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'ZAR',
  recovered_at timestamptz NOT NULL DEFAULT now(),
  status public.recovery_status NOT NULL DEFAULT 'attributed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_recoveries TO authenticated;
GRANT ALL ON public.sales_recoveries TO service_role;
ALTER TABLE public.sales_recoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_select ON public.sales_recoveries FOR SELECT TO authenticated USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY sr_write ON public.sales_recoveries FOR ALL TO authenticated USING (public.can_manage_retailer(auth.uid(), retailer_id)) WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES public.retailers(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, entity_type text NOT NULL, entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.audit_status NOT NULL DEFAULT 'success',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY al_select ON public.audit_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'super_admin')
  OR (retailer_id IS NOT NULL AND public.has_any_role(auth.uid(), ARRAY['retail_admin']::app_role[]) AND public.belongs_to_retailer(auth.uid(), retailer_id))
);
CREATE POLICY al_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (
  retailer_id IS NULL OR public.belongs_to_retailer(auth.uid(), retailer_id)
);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz, seats integer NOT NULL DEFAULT 1, provider_ref text,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_select ON public.subscriptions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'super_admin')
  OR (public.has_any_role(auth.uid(), ARRAY['retail_admin']::app_role[]) AND public.belongs_to_retailer(auth.uid(), retailer_id))
);
CREATE POLICY sub_write ON public.subscriptions FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin')
  OR (public.has_any_role(auth.uid(), ARRAY['retail_admin']::app_role[]) AND public.belongs_to_retailer(auth.uid(), retailer_id))
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR (public.has_any_role(auth.uid(), ARRAY['retail_admin']::app_role[]) AND public.belongs_to_retailer(auth.uid(), retailer_id))
);

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'retailers','stores','staff','product_categories','products','qr_tags',
    'customers','customer_interests','notification_campaigns','notification_history',
    'conversations','conversation_messages','promotion_events','redemption_codes',
    'sales_recoveries','audit_logs','subscriptions'
  ])
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();', t);
  END LOOP;
END $$;

CREATE INDEX ON public.stores (retailer_id);
CREATE INDEX ON public.staff (retailer_id);
CREATE INDEX ON public.products (retailer_id, category_id);
CREATE INDEX ON public.qr_tags (retailer_id, product_id);
CREATE INDEX ON public.customers (retailer_id);
CREATE INDEX ON public.customer_interests (retailer_id, customer_id, product_id);
CREATE INDEX ON public.notification_history (retailer_id, customer_id);
CREATE INDEX ON public.conversation_messages (conversation_id, sent_at);
CREATE INDEX ON public.redemption_codes (retailer_id, promotion_id);
CREATE INDEX ON public.sales_recoveries (retailer_id, recovered_at);
CREATE INDEX ON public.audit_logs (retailer_id, created_at);
