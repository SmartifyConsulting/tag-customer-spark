
-- Extend product_qr_assets with lifecycle columns
ALTER TABLE public.product_qr_assets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS generated_by uuid,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

ALTER TABLE public.product_qr_assets
  DROP CONSTRAINT IF EXISTS product_qr_assets_status_chk;
ALTER TABLE public.product_qr_assets
  ADD CONSTRAINT product_qr_assets_status_chk CHECK (status IN ('active','retired'));

-- One active QR per GTIN
CREATE UNIQUE INDEX IF NOT EXISTS product_qr_assets_active_gtin_uidx
  ON public.product_qr_assets (gtin)
  WHERE status = 'active';

-- Product-level flags
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS qr_status text,
  ADD COLUMN IF NOT EXISTS on_promotion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotion_label text;

-- Broadcast campaigns (global marketing WhatsApp)
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  body text NOT NULL,
  cta_url text,
  recipient_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_campaigns TO authenticated;
GRANT ALL ON public.broadcast_campaigns TO service_role;

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer members can view broadcasts"
  ON public.broadcast_campaigns FOR SELECT
  TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "Retailer managers can create broadcasts"
  ON public.broadcast_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE POLICY "Retailer managers can update broadcasts"
  ON public.broadcast_campaigns FOR UPDATE
  TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));
