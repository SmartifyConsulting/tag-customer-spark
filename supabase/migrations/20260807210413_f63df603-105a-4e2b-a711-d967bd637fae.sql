DO $$ BEGIN
  CREATE TYPE public.receipt_status AS ENUM ('paper','digital','synced','pending','failed','returned','refunded','warranty_registered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS status public.receipt_status NOT NULL DEFAULT 'digital';

CREATE INDEX IF NOT EXISTS idx_purchases_receipt_number ON public.purchases (receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts (receipt_number);
CREATE INDEX IF NOT EXISTS idx_owned_products_serial ON public.owned_products (serial_number);
CREATE INDEX IF NOT EXISTS idx_owned_products_room ON public.owned_products (room_id);