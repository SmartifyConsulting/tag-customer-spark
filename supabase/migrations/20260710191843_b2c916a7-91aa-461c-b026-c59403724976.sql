
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS heading text,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sending',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.notification_history
  ADD COLUMN IF NOT EXISTS broadcast_id uuid REFERENCES public.broadcast_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_history_broadcast_id
  ON public.notification_history(broadcast_id) WHERE broadcast_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_retailer_marketing
  ON public.customers(retailer_id) WHERE marketing_consent_at IS NOT NULL;
