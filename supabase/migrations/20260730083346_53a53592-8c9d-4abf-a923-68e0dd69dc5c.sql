-- 1. Watch tracking columns on the existing watchlists table
ALTER TABLE public.watchlists
  ADD COLUMN IF NOT EXISTS price_when_added integer,
  ADD COLUMN IF NOT EXISTS last_known_price integer,
  ADD COLUMN IF NOT EXISTS last_known_stock integer,
  ADD COLUMN IF NOT EXISTS last_notified_price integer,
  ADD COLUMN IF NOT EXISTS last_notified_stock integer,
  ADD COLUMN IF NOT EXISTS last_known_intent_score numeric,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS last_price_drop_sent timestamptz,
  ADD COLUMN IF NOT EXISTS last_low_stock_sent timestamptz,
  ADD COLUMN IF NOT EXISTS last_last_one_sent timestamptz,
  ADD COLUMN IF NOT EXISTS last_back_in_stock_sent timestamptz,
  ADD COLUMN IF NOT EXISTS last_high_interest_sent timestamptz;

-- Backfill snapshots from current product state
UPDATE public.watchlists w
SET price_when_added = COALESCE(w.price_when_added, COALESCE(p.sale_price_cents, p.price_cents)),
    last_known_price = COALESCE(w.last_known_price, COALESCE(p.sale_price_cents, p.price_cents)),
    last_known_stock = COALESCE(w.last_known_stock, p.stock_qty),
    last_known_intent_score = COALESCE(w.last_known_intent_score, p.intent_score)
FROM public.products p
WHERE p.id = w.product_id;

UPDATE public.watchlists w
SET whatsapp_number = c.whatsapp_e164
FROM public.customers c
WHERE c.id = w.customer_id AND w.whatsapp_number IS NULL;

CREATE INDEX IF NOT EXISTS watchlists_active_product_idx
  ON public.watchlists (product_id) WHERE status = 'active';

-- 2. Automation settings, one row per retailer per automation
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  automation_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  threshold numeric,
  template_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, automation_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_settings TO authenticated;
GRANT ALL ON public.automation_settings TO service_role;

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_settings_select" ON public.automation_settings
  FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "automation_settings_insert" ON public.automation_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE POLICY "automation_settings_update" ON public.automation_settings
  FOR UPDATE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE POLICY "automation_settings_delete" ON public.automation_settings
  FOR DELETE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TRIGGER automation_settings_set_updated_at
  BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();