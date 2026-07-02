
-- Extend retailers with billing metadata
ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_country text NOT NULL DEFAULT 'ZA',
  ADD COLUMN IF NOT EXISTS vat_number text;

-- Extend subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- payment_purchases
CREATE TABLE IF NOT EXISTS public.payment_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('payfast','paypal')),
  provider_order_id text NOT NULL,
  plan text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_order_id)
);
GRANT SELECT ON public.payment_purchases TO authenticated;
GRANT ALL ON public.payment_purchases TO service_role;
ALTER TABLE public.payment_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing: retail admins read own retailer purchases"
  ON public.payment_purchases FOR SELECT TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id));
CREATE TRIGGER tg_payment_purchases_updated
  BEFORE UPDATE ON public.payment_purchases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- billing_events (audit)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES public.retailers(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_events: retail admins read own retailer events"
  ON public.billing_events FOR SELECT TO authenticated
  USING (retailer_id IS NOT NULL AND public.can_manage_retailer(auth.uid(), retailer_id));

-- Grant tier + upsert subscription atomically (service-role callers)
CREATE OR REPLACE FUNCTION public.apply_paid_tier(
  _retailer_id uuid,
  _tier tag_tier,
  _cycle text,
  _period_end timestamptz,
  _provider text,
  _provider_sub_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.retailers SET tier = _tier, updated_at = now() WHERE id = _retailer_id;

  INSERT INTO public.subscriptions
    (retailer_id, plan, current_period_start, current_period_end, seats, provider_ref,
     status, provider, provider_subscription_id, billing_cycle)
  VALUES
    (_retailer_id, _tier::text, now(), _period_end, 5, _provider_sub_id,
     'active', _provider, _provider_sub_id, _cycle)
  ON CONFLICT (retailer_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    provider = EXCLUDED.provider,
    provider_subscription_id = EXCLUDED.provider_subscription_id,
    billing_cycle = EXCLUDED.billing_cycle,
    status = 'active',
    cancel_at_period_end = false,
    updated_at = now();
END $$;

-- subscriptions may not have a unique constraint on retailer_id yet; add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_retailer_id_key'
  ) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_retailer_id_key UNIQUE (retailer_id);
  END IF;
END $$;
