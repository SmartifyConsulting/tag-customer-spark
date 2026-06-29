
-- ===== Customer consent fields =====
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS notify_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'scan';

CREATE UNIQUE INDEX IF NOT EXISTS customers_retailer_phone_uidx
  ON public.customers (retailer_id, whatsapp_e164);

-- ===== Conversations: assignment, tags, resolution, unread =====
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unread_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subject TEXT;

ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ===== Notification campaigns: visual builder fields =====
ALTER TABLE public.notification_campaigns
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS cta_url TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redemption_code TEXT,
  ADD COLUMN IF NOT EXISTS audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_size INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funnel JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Extend campaign_type & status to include 'custom' and 'completed'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='custom' AND enumtypid='public.campaign_type'::regtype) THEN
    ALTER TYPE public.campaign_type ADD VALUE 'custom';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='completed' AND enumtypid='public.campaign_status'::regtype) THEN
    ALTER TYPE public.campaign_status ADD VALUE 'completed';
  END IF;
END $$;

-- ===== Notification history: extra tracking =====
ALTER TABLE public.notification_history
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='clicked' AND enumtypid='public.notification_status'::regtype) THEN
    ALTER TYPE public.notification_status ADD VALUE 'clicked';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='redeemed' AND enumtypid='public.notification_status'::regtype) THEN
    ALTER TYPE public.notification_status ADD VALUE 'redeemed';
  END IF;
END $$;

-- ===== Public scan view: safe slice for anonymous landing page =====
CREATE OR REPLACE VIEW public.public_scan_view
WITH (security_invoker = true) AS
SELECT
  q.id               AS qr_tag_id,
  q.short_code,
  q.is_active        AS qr_active,
  q.store_id,
  s.name             AS store_name,
  p.id               AS product_id,
  p.name             AS product_name,
  p.brand            AS product_brand,
  p.description      AS product_description,
  p.price_cents,
  p.sale_price_cents,
  p.currency,
  p.image_url,
  p.images,
  p.color,
  p.size,
  p.promotion_start_date,
  p.promotion_end_date,
  p.status           AS product_status,
  r.id               AS retailer_id,
  r.name             AS retailer_name,
  r.slug             AS retailer_slug,
  r.logo_url         AS retailer_logo
FROM public.qr_tags q
JOIN public.products p ON p.id = q.product_id
JOIN public.retailers r ON r.id = q.retailer_id
LEFT JOIN public.stores s ON s.id = q.store_id
WHERE q.is_active = true AND p.status = 'active';

GRANT SELECT ON public.public_scan_view TO anon, authenticated;

-- ===== Realtime: conversations + messages =====
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversations';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversation_messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages';
  END IF;
END $$;

-- ===== Trigger: keep conversations.last_message_at and unread_count fresh =====
CREATE OR REPLACE FUNCTION public.tg_conversation_message_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.conversations
    SET last_message_at = NEW.sent_at,
        unread_count = CASE WHEN NEW.direction = 'inbound' AND NOT NEW.is_internal
                            THEN unread_count + 1 ELSE unread_count END,
        updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS conversation_message_after_insert ON public.conversation_messages;
CREATE TRIGGER conversation_message_after_insert
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_conversation_message_after_insert();

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS conversations_retailer_last_idx
  ON public.conversations (retailer_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS conversation_messages_conv_idx
  ON public.conversation_messages (conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS notification_history_campaign_idx
  ON public.notification_history (campaign_id, status);
CREATE INDEX IF NOT EXISTS qr_scans_retailer_time_idx
  ON public.qr_scans (retailer_id, scanned_at DESC);
