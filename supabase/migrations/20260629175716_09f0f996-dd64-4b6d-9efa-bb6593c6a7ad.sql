
CREATE TYPE public.watchlist_trigger AS ENUM ('on_sale','back_in_stock','low_stock','price_drop_below','any_update');
CREATE TYPE public.watchlist_status  AS ENUM ('active','paused','fired','expired','cancelled');

CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id)  ON DELETE CASCADE,
  trigger public.watchlist_trigger NOT NULL DEFAULT 'any_update',
  target_price_cents int,
  channel text NOT NULL DEFAULT 'whatsapp',
  status public.watchlist_status NOT NULL DEFAULT 'active',
  last_fired_at timestamptz,
  fired_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  UNIQUE (customer_id, product_id, trigger)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlists read by retailer" ON public.watchlists FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY "watchlists manage by retailer" ON public.watchlists FOR ALL TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE INDEX idx_watchlists_product ON public.watchlists(product_id, status);
CREATE INDEX idx_watchlists_customer ON public.watchlists(customer_id, status);
CREATE TRIGGER set_updated_at_watchlists BEFORE UPDATE ON public.watchlists
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.watchlist_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  retailer_id  uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  trigger public.watchlist_trigger NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_id uuid REFERENCES public.notification_history(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_events TO authenticated;
GRANT ALL ON public.watchlist_events TO service_role;
ALTER TABLE public.watchlist_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_events by retailer" ON public.watchlist_events FOR ALL TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE INDEX idx_watchlist_events_retailer ON public.watchlist_events(retailer_id, created_at DESC);

CREATE TYPE public.roi_attribution_model AS ENUM ('last_touch','first_touch','linear');
CREATE TYPE public.roi_touchpoint       AS ENUM ('scan','notification','watchlist','manual');

CREATE TABLE public.roi_settings (
  retailer_id uuid PRIMARY KEY REFERENCES public.retailers(id) ON DELETE CASCADE,
  attribution_window_hours int NOT NULL DEFAULT 168,
  cost_per_message_cents int NOT NULL DEFAULT 15,
  default_margin_pct numeric NOT NULL DEFAULT 0.35,
  currency text NOT NULL DEFAULT 'ZAR',
  model public.roi_attribution_model NOT NULL DEFAULT 'last_touch',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roi_settings TO authenticated;
GRANT ALL ON public.roi_settings TO service_role;
ALTER TABLE public.roi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roi_settings read" ON public.roi_settings FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE POLICY "roi_settings manage" ON public.roi_settings FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));
CREATE TRIGGER set_updated_at_roi_settings BEFORE UPDATE ON public.roi_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.roi_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  sales_recovery_id uuid NOT NULL REFERENCES public.sales_recoveries(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  product_id  uuid REFERENCES public.products(id)  ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.notification_campaigns(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.notification_history(id) ON DELETE SET NULL,
  qr_tag_id uuid REFERENCES public.qr_tags(id) ON DELETE SET NULL,
  watchlist_id uuid REFERENCES public.watchlists(id) ON DELETE SET NULL,
  touchpoint public.roi_touchpoint NOT NULL,
  model public.roi_attribution_model NOT NULL DEFAULT 'last_touch',
  attributed_revenue_cents int NOT NULL DEFAULT 0,
  margin_cents int NOT NULL DEFAULT 0,
  cost_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'attributed',
  attributed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (sales_recovery_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roi_attributions TO authenticated;
GRANT ALL ON public.roi_attributions TO service_role;
ALTER TABLE public.roi_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roi_attributions by retailer" ON public.roi_attributions FOR ALL TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
CREATE INDEX idx_roi_attr_retailer ON public.roi_attributions(retailer_id, attributed_at DESC);
CREATE INDEX idx_roi_attr_campaign ON public.roi_attributions(campaign_id);
CREATE INDEX idx_roi_attr_product  ON public.roi_attributions(product_id);
CREATE TRIGGER set_updated_at_roi_attr BEFORE UPDATE ON public.roi_attributions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.run_roi_attribution_sweep(_retailer_id uuid DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  sr RECORD; rs RECORD; inserted_count int := 0;
  best_notif RECORD; best_scan RECORD; best_watch RECORD;
  touch public.roi_touchpoint; revenue int; margin int; cost int; msg_count int;
BEGIN
  FOR sr IN
    SELECT s.* FROM public.sales_recoveries s
    LEFT JOIN public.roi_attributions a ON a.sales_recovery_id = s.id
    WHERE a.id IS NULL AND (_retailer_id IS NULL OR s.retailer_id = _retailer_id)
    ORDER BY s.recovered_at ASC LIMIT 500
  LOOP
    SELECT * INTO rs FROM public.roi_settings WHERE retailer_id = sr.retailer_id;
    IF rs IS NULL THEN
      INSERT INTO public.roi_settings(retailer_id) VALUES (sr.retailer_id) ON CONFLICT DO NOTHING;
      SELECT * INTO rs FROM public.roi_settings WHERE retailer_id = sr.retailer_id;
    END IF;

    SELECT nh.id AS notification_id, nh.campaign_id, nh.created_at INTO best_notif
    FROM public.notification_history nh
    JOIN public.notification_campaigns nc ON nc.id = nh.campaign_id
    WHERE nh.customer_id = sr.customer_id
      AND nh.created_at <= sr.recovered_at
      AND nh.created_at >= sr.recovered_at - make_interval(hours => rs.attribution_window_hours)
      AND (sr.product_id IS NULL OR nc.product_id = sr.product_id OR nc.product_id IS NULL)
    ORDER BY nh.created_at DESC LIMIT 1;

    SELECT qs.id AS scan_id, qs.qr_tag_id, qs.scanned_at INTO best_scan
    FROM public.qr_scans qs
    WHERE qs.customer_id = sr.customer_id
      AND qs.scanned_at <= sr.recovered_at
      AND qs.scanned_at >= sr.recovered_at - make_interval(hours => rs.attribution_window_hours)
      AND (sr.product_id IS NULL OR qs.product_id = sr.product_id)
    ORDER BY qs.scanned_at DESC LIMIT 1;

    SELECT we.id, we.watchlist_id, we.created_at INTO best_watch
    FROM public.watchlist_events we JOIN public.watchlists w ON w.id = we.watchlist_id
    WHERE w.customer_id = sr.customer_id
      AND we.created_at <= sr.recovered_at
      AND we.created_at >= sr.recovered_at - make_interval(hours => rs.attribution_window_hours)
      AND (sr.product_id IS NULL OR w.product_id = sr.product_id)
    ORDER BY we.created_at DESC LIMIT 1;

    IF best_notif IS NOT NULL AND
       (best_scan IS NULL OR best_notif.created_at >= best_scan.scanned_at) AND
       (best_watch IS NULL OR best_notif.created_at >= best_watch.created_at) THEN
      touch := 'notification';
    ELSIF best_watch IS NOT NULL AND (best_scan IS NULL OR best_watch.created_at >= best_scan.scanned_at) THEN
      touch := 'watchlist';
    ELSIF best_scan IS NOT NULL THEN touch := 'scan';
    ELSE touch := 'manual';
    END IF;

    revenue := COALESCE(sr.amount_cents, 0);
    margin  := (revenue * COALESCE(rs.default_margin_pct, 0.35))::int;
    SELECT COUNT(*) INTO msg_count FROM public.notification_history nh
      WHERE nh.customer_id = sr.customer_id
        AND nh.created_at <= sr.recovered_at
        AND nh.created_at >= sr.recovered_at - make_interval(hours => rs.attribution_window_hours);
    cost := COALESCE(msg_count, 0) * COALESCE(rs.cost_per_message_cents, 15);

    INSERT INTO public.roi_attributions
      (retailer_id, sales_recovery_id, customer_id, product_id,
       campaign_id, notification_id, qr_tag_id, watchlist_id,
       touchpoint, model, attributed_revenue_cents, margin_cents, cost_cents)
    VALUES
      (sr.retailer_id, sr.id, sr.customer_id, sr.product_id,
       CASE WHEN touch='notification' THEN best_notif.campaign_id END,
       CASE WHEN touch='notification' THEN best_notif.notification_id END,
       CASE WHEN touch='scan'         THEN best_scan.qr_tag_id END,
       CASE WHEN touch='watchlist'    THEN best_watch.watchlist_id END,
       touch, rs.model, revenue, margin, cost)
    ON CONFLICT (sales_recovery_id) DO NOTHING;

    inserted_count := inserted_count + 1;
  END LOOP;
  RETURN inserted_count;
END $$;
GRANT EXECUTE ON FUNCTION public.run_roi_attribution_sweep(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_watchlist_on_product_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE w RECORD;
BEGIN
  IF NEW.sale_price_cents IS NOT NULL AND NEW.sale_price_cents < COALESCE(OLD.sale_price_cents, OLD.price_cents) THEN
    FOR w IN SELECT * FROM public.watchlists
      WHERE product_id = NEW.id AND status = 'active'
        AND trigger IN ('on_sale','price_drop_below','any_update')
        AND (trigger <> 'price_drop_below' OR (target_price_cents IS NOT NULL AND NEW.sale_price_cents <= target_price_cents))
    LOOP
      INSERT INTO public.watchlist_events(watchlist_id, retailer_id, trigger, payload)
        VALUES (w.id, w.retailer_id, w.trigger,
                jsonb_build_object('new_price_cents', NEW.sale_price_cents, 'old_price_cents', OLD.sale_price_cents));
      UPDATE public.watchlists SET last_fired_at = now(), fired_count = fired_count + 1, status = 'fired' WHERE id = w.id;
    END LOOP;
  END IF;

  IF COALESCE(OLD.stock_qty,0) = 0 AND COALESCE(NEW.stock_qty,0) > 0 THEN
    FOR w IN SELECT * FROM public.watchlists
      WHERE product_id = NEW.id AND status = 'active' AND trigger IN ('back_in_stock','any_update')
    LOOP
      INSERT INTO public.watchlist_events(watchlist_id, retailer_id, trigger, payload)
        VALUES (w.id, w.retailer_id, 'back_in_stock', jsonb_build_object('stock_qty', NEW.stock_qty));
      UPDATE public.watchlists SET last_fired_at = now(), fired_count = fired_count + 1, status = 'fired' WHERE id = w.id;
    END LOOP;
  END IF;

  IF NEW.stock_qty IS NOT NULL AND NEW.low_stock_threshold IS NOT NULL
     AND NEW.stock_qty <= NEW.low_stock_threshold
     AND COALESCE(OLD.stock_qty, NEW.low_stock_threshold + 1) > NEW.low_stock_threshold THEN
    FOR w IN SELECT * FROM public.watchlists
      WHERE product_id = NEW.id AND status = 'active' AND trigger IN ('low_stock','any_update')
    LOOP
      INSERT INTO public.watchlist_events(watchlist_id, retailer_id, trigger, payload)
        VALUES (w.id, w.retailer_id, 'low_stock', jsonb_build_object('stock_qty', NEW.stock_qty));
      UPDATE public.watchlists SET last_fired_at = now(), fired_count = fired_count + 1, status = 'fired' WHERE id = w.id;
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_watchlist_on_product_change
  AFTER UPDATE OF price_cents, sale_price_cents, stock_qty ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_watchlist_on_product_change();
