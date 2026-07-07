
-- 1. Expand tag_tier enum
ALTER TYPE public.tag_tier ADD VALUE IF NOT EXISTS 'go' BEFORE 'starter';
ALTER TYPE public.tag_tier ADD VALUE IF NOT EXISTS 'growth' AFTER 'starter';

-- 2. Usage counters
CREATE TABLE IF NOT EXISTS public.notification_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  included_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  overage_cents_accrued integer NOT NULL DEFAULT 0,
  overage_rate_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, period_start)
);
GRANT SELECT ON public.notification_usage_counters TO authenticated;
GRANT ALL ON public.notification_usage_counters TO service_role;
ALTER TABLE public.notification_usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_counters_read_own"
  ON public.notification_usage_counters FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE TRIGGER trg_usage_counters_updated
  BEFORE UPDATE ON public.notification_usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Overage invoices
CREATE TABLE IF NOT EXISTS public.notification_overage_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  msg_over integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  provider text,
  provider_txn_id text,
  status text NOT NULL DEFAULT 'pending',
  payment_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_overage_invoices TO authenticated;
GRANT ALL ON public.notification_overage_invoices TO service_role;
ALTER TABLE public.notification_overage_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overage_invoices_read_own"
  ON public.notification_overage_invoices FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE TRIGGER trg_overage_invoices_updated
  BEFORE UPDATE ON public.notification_overage_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Sales leads (Tag Enterprise "Contact sales")
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES public.retailers(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  company text,
  branches integer,
  message text,
  source text NOT NULL DEFAULT 'enterprise_contact',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sales_leads TO authenticated;
GRANT ALL ON public.sales_leads TO service_role;
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_leads_insert_own"
  ON public.sales_leads FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "sales_leads_read_own_or_super"
  ON public.sales_leads FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_sales_leads_updated
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
