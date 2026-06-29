-- ============================================================
-- PHASE 1: AI Retail Intelligence + Intent Score Engine
-- ============================================================

-- 1. Product extensions for Intent Score -------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS intent_score numeric(5,2) NOT NULL DEFAULT 50.0,
  ADD COLUMN IF NOT EXISTS intent_score_confidence numeric(3,2) NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS intent_score_trend text NOT NULL DEFAULT 'stable'
    CHECK (intent_score_trend IN ('rising','falling','stable')),
  ADD COLUMN IF NOT EXISTS intent_score_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_products_intent_score
  ON public.products (retailer_id, intent_score DESC);

ALTER TABLE public.qr_scans
  ADD COLUMN IF NOT EXISTS dwell_ms integer;

-- 2. Intent signals rollup ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_intent_signals (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  scans_total integer NOT NULL DEFAULT 0,
  scans_unique integer NOT NULL DEFAULT 0,
  repeat_scans integer NOT NULL DEFAULT 0,
  avg_time_on_page_seconds numeric(8,2) NOT NULL DEFAULT 0,
  viewers integer NOT NULL DEFAULT 0,
  watchlist_adds integer NOT NULL DEFAULT 0,
  notif_engagement integer NOT NULL DEFAULT 0,
  conversion_rate numeric(6,4) NOT NULL DEFAULT 0,
  add_to_cart_rate numeric(6,4) NOT NULL DEFAULT 0,
  price_impact numeric(6,4) NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_intent_signals TO authenticated;
GRANT ALL ON public.product_intent_signals TO service_role;
ALTER TABLE public.product_intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer reads own intent signals"
  ON public.product_intent_signals FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

-- 3. Intent history (daily snapshot for trend + forecast) --------------------
CREATE TABLE IF NOT EXISTS public.product_intent_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  intent_score numeric(5,2) NOT NULL,
  sample_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_intent_history_product_date
  ON public.product_intent_history (product_id, snapshot_date DESC);

GRANT SELECT ON public.product_intent_history TO authenticated;
GRANT ALL ON public.product_intent_history TO service_role;
ALTER TABLE public.product_intent_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer reads own intent history"
  ON public.product_intent_history FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

-- 4. Intent forecast ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_intent_forecast (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  predicted_score_7d numeric(5,2) NOT NULL,
  predicted_score_14d numeric(5,2) NOT NULL,
  predicted_trend text NOT NULL CHECK (predicted_trend IN ('increase','decrease','stable')),
  forecast_confidence numeric(3,2) NOT NULL DEFAULT 0.0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_intent_forecast TO authenticated;
GRANT ALL ON public.product_intent_forecast TO service_role;
ALTER TABLE public.product_intent_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer reads own intent forecast"
  ON public.product_intent_forecast FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

-- 5. Per-retailer weight config ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.intent_score_weights (
  retailer_id uuid PRIMARY KEY REFERENCES public.retailers(id) ON DELETE CASCADE,
  w_scans numeric(4,3) NOT NULL DEFAULT 0.15,
  w_repeat numeric(4,3) NOT NULL DEFAULT 0.10,
  w_time numeric(4,3) NOT NULL DEFAULT 0.10,
  w_viewers numeric(4,3) NOT NULL DEFAULT 0.10,
  w_watchlist numeric(4,3) NOT NULL DEFAULT 0.10,
  w_notif numeric(4,3) NOT NULL DEFAULT 0.10,
  w_conversion numeric(4,3) NOT NULL DEFAULT 0.20,
  w_cart numeric(4,3) NOT NULL DEFAULT 0.10,
  w_price numeric(4,3) NOT NULL DEFAULT 0.05,
  forecast_sensitivity text NOT NULL DEFAULT 'balanced'
    CHECK (forecast_sensitivity IN ('conservative','balanced','aggressive')),
  forecasting_enabled boolean NOT NULL DEFAULT true,
  update_frequency_minutes integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.intent_score_weights TO authenticated;
GRANT INSERT, UPDATE ON public.intent_score_weights TO authenticated;
GRANT ALL ON public.intent_score_weights TO service_role;
ALTER TABLE public.intent_score_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer reads own weights"
  ON public.intent_score_weights FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "Retailer manages own weights"
  ON public.intent_score_weights FOR ALL TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

-- 6. Recompute queue (service-role only) ------------------------------------
CREATE TABLE IF NOT EXISTS public.intent_recompute_queue (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  enqueued_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.intent_recompute_queue TO service_role;
ALTER TABLE public.intent_recompute_queue ENABLE ROW LEVEL SECURITY;
-- No policies -> only service_role can touch it.

-- 7. AI insights -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.ai_insight_kind AS ENUM (
    'opportunity','executive_summary','weekly_report','conversation_summary','merchandising'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_insight_status AS ENUM ('active','dismissed','expired','accepted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  kind public.ai_insight_kind NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_entity_type text,
  related_entity_id uuid,
  score numeric(6,2),
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status public.ai_insight_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_retailer_kind
  ON public.ai_insights (retailer_id, kind, generated_at DESC);

GRANT SELECT, UPDATE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer reads own AI insights"
  ON public.ai_insights FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "Retailer updates own AI insights"
  ON public.ai_insights FOR UPDATE TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TRIGGER tg_ai_insights_updated_at
  BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 8. AI recommendations ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  title text NOT NULL,
  description text,
  projected_value_cents bigint,
  currency text NOT NULL DEFAULT 'ZAR',
  confidence numeric(3,2) NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','expired')),
  accepted_at timestamptz,
  dismissed_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recs_retailer
  ON public.ai_recommendations (retailer_id, status, generated_at DESC);

GRANT SELECT, UPDATE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer reads own recommendations"
  ON public.ai_recommendations FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "Retailer updates own recommendations"
  ON public.ai_recommendations FOR UPDATE TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE TRIGGER tg_ai_recommendations_updated_at
  BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 9. Enqueue + recompute functions ------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_intent_recompute(_product_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.intent_recompute_queue(product_id)
  VALUES (_product_id)
  ON CONFLICT (product_id) DO UPDATE SET enqueued_at = now();
$$;

CREATE OR REPLACE FUNCTION public.tg_enqueue_intent_from_scan()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN PERFORM public.enqueue_intent_recompute(NEW.product_id); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.tg_enqueue_intent_from_interest()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    PERFORM public.enqueue_intent_recompute(NEW.product_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_enqueue_intent_from_recovery()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    PERFORM public.enqueue_intent_recompute(NEW.product_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_enqueue_intent_from_product()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.price_cents IS DISTINCT FROM OLD.price_cents THEN
    PERFORM public.enqueue_intent_recompute(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_intent_from_scan ON public.qr_scans;
CREATE TRIGGER tg_intent_from_scan
  AFTER INSERT ON public.qr_scans
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_intent_from_scan();

DROP TRIGGER IF EXISTS tg_intent_from_interest ON public.customer_interests;
CREATE TRIGGER tg_intent_from_interest
  AFTER INSERT ON public.customer_interests
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_intent_from_interest();

DROP TRIGGER IF EXISTS tg_intent_from_recovery ON public.sales_recoveries;
CREATE TRIGGER tg_intent_from_recovery
  AFTER INSERT ON public.sales_recoveries
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_intent_from_recovery();

DROP TRIGGER IF EXISTS tg_intent_from_product ON public.products;
CREATE TRIGGER tg_intent_from_product
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_intent_from_product();

-- 10. recompute_product_intent (weighted score from spec) -------------------
CREATE OR REPLACE FUNCTION public.recompute_product_intent(_product_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  rid uuid;
  w intent_score_weights%ROWTYPE;
  scans_total int := 0;
  scans_unique int := 0;
  repeat_scans int := 0;
  avg_time numeric := 0;
  viewers int := 0;
  watchlist_adds int := 0;
  notif_eng int := 0;
  conv_rate numeric := 0;
  cart_rate numeric := 0;
  price_impact numeric := 0;
  sample int := 0;
  max_scans int := 1;
  max_time numeric := 120; -- seconds dwell baseline
  max_viewers int := 1;
  max_repeat int := 1;
  max_watchlist int := 1;
  max_notif int := 1;
  score numeric := 50;
  confidence numeric := 0;
  prev numeric;
  trend text := 'stable';
BEGIN
  SELECT retailer_id INTO rid FROM public.products WHERE id = _product_id;
  IF rid IS NULL THEN RETURN; END IF;

  -- weights
  SELECT * INTO w FROM public.intent_score_weights WHERE retailer_id = rid;
  IF NOT FOUND THEN
    INSERT INTO public.intent_score_weights(retailer_id) VALUES (rid)
    ON CONFLICT DO NOTHING;
    SELECT * INTO w FROM public.intent_score_weights WHERE retailer_id = rid;
  END IF;

  -- raw signals (30-day window)
  SELECT COUNT(*),
         COUNT(DISTINCT COALESCE(customer_id::text, ip_hash, id::text)),
         COALESCE(AVG(dwell_ms)/1000.0, 0),
         COUNT(DISTINCT COALESCE(customer_id::text, ip_hash, id::text))
  INTO scans_total, scans_unique, avg_time, viewers
  FROM public.qr_scans
  WHERE product_id = _product_id
    AND scanned_at >= now() - interval '30 days';

  -- repeat scans = scans_total - unique
  repeat_scans := GREATEST(scans_total - scans_unique, 0);

  -- watchlist adds (placeholder until Phase 2 watchlists table exists -> use customer_interests as proxy)
  SELECT COUNT(*) INTO watchlist_adds
  FROM public.customer_interests
  WHERE product_id = _product_id
    AND created_at >= now() - interval '30 days';

  -- notification engagement = clicks + redemptions for campaigns tied to this product
  SELECT COALESCE(COUNT(*) FILTER (WHERE nh.status IN ('clicked','redeemed','read')),0)
  INTO notif_eng
  FROM public.notification_history nh
  JOIN public.notification_campaigns nc ON nc.id = nh.campaign_id
  WHERE nc.product_id = _product_id
    AND nh.created_at >= now() - interval '30 days';

  -- conversion = recoveries / unique viewers
  conv_rate := CASE WHEN scans_unique > 0 THEN
    (SELECT COUNT(*)::numeric FROM public.sales_recoveries
       WHERE product_id = _product_id
         AND recovered_at >= now() - interval '30 days') / scans_unique
  ELSE 0 END;
  conv_rate := LEAST(conv_rate, 1);

  -- cart rate proxy = interests / unique scans
  cart_rate := CASE WHEN scans_unique > 0
    THEN LEAST(watchlist_adds::numeric / scans_unique, 1)
    ELSE 0 END;

  -- price impact: if a sale_price is active, give weight; else 0
  SELECT CASE
    WHEN sale_price_cents IS NOT NULL AND sale_price_cents < price_cents THEN
      LEAST((price_cents - sale_price_cents)::numeric / NULLIF(price_cents,0), 1)
    ELSE 0 END
  INTO price_impact
  FROM public.products WHERE id = _product_id;

  sample := scans_total + watchlist_adds + notif_eng;

  -- normalisation maxima across retailer
  SELECT GREATEST(MAX(scans_total),1) INTO max_scans FROM public.product_intent_signals WHERE retailer_id = rid;
  SELECT GREATEST(MAX(avg_time_on_page_seconds),max_time) INTO max_time FROM public.product_intent_signals WHERE retailer_id = rid;
  SELECT GREATEST(MAX(viewers),1) INTO max_viewers FROM public.product_intent_signals WHERE retailer_id = rid;
  SELECT GREATEST(MAX(repeat_scans),1) INTO max_repeat FROM public.product_intent_signals WHERE retailer_id = rid;
  SELECT GREATEST(MAX(watchlist_adds),1) INTO max_watchlist FROM public.product_intent_signals WHERE retailer_id = rid;
  SELECT GREATEST(MAX(notif_engagement),1) INTO max_notif FROM public.product_intent_signals WHERE retailer_id = rid;

  IF sample = 0 THEN
    score := 50;
    confidence := 0;
  ELSE
    score := 100 * (
        w.w_scans      * LEAST(scans_total::numeric / max_scans, 1)
      + w.w_repeat     * LEAST(repeat_scans::numeric / max_repeat, 1)
      + w.w_time       * LEAST(avg_time / max_time, 1)
      + w.w_viewers    * LEAST(viewers::numeric / max_viewers, 1)
      + w.w_watchlist  * LEAST(watchlist_adds::numeric / max_watchlist, 1)
      + w.w_notif      * LEAST(notif_eng::numeric / max_notif, 1)
      + w.w_conversion * conv_rate
      + w.w_cart       * cart_rate
      + w.w_price      * price_impact
    );
    score := LEAST(GREATEST(score, 0), 100);
    confidence := LEAST(sample::numeric / 50.0, 1);
  END IF;

  -- upsert signal row
  INSERT INTO public.product_intent_signals AS s
    (product_id, retailer_id, scans_total, scans_unique, repeat_scans,
     avg_time_on_page_seconds, viewers, watchlist_adds, notif_engagement,
     conversion_rate, add_to_cart_rate, price_impact, sample_size, updated_at)
  VALUES
    (_product_id, rid, scans_total, scans_unique, repeat_scans,
     avg_time, viewers, watchlist_adds, notif_eng,
     conv_rate, cart_rate, price_impact, sample, now())
  ON CONFLICT (product_id) DO UPDATE SET
    scans_total = EXCLUDED.scans_total,
    scans_unique = EXCLUDED.scans_unique,
    repeat_scans = EXCLUDED.repeat_scans,
    avg_time_on_page_seconds = EXCLUDED.avg_time_on_page_seconds,
    viewers = EXCLUDED.viewers,
    watchlist_adds = EXCLUDED.watchlist_adds,
    notif_engagement = EXCLUDED.notif_engagement,
    conversion_rate = EXCLUDED.conversion_rate,
    add_to_cart_rate = EXCLUDED.add_to_cart_rate,
    price_impact = EXCLUDED.price_impact,
    sample_size = EXCLUDED.sample_size,
    updated_at = now();

  -- trend: compare to score 7 days ago
  SELECT intent_score INTO prev
  FROM public.product_intent_history
  WHERE product_id = _product_id AND snapshot_date <= CURRENT_DATE - 7
  ORDER BY snapshot_date DESC LIMIT 1;

  IF prev IS NULL THEN
    trend := 'stable';
  ELSIF score > prev + 3 THEN trend := 'rising';
  ELSIF score < prev - 3 THEN trend := 'falling';
  ELSE trend := 'stable';
  END IF;

  UPDATE public.products
  SET intent_score = score,
      intent_score_confidence = confidence,
      intent_score_trend = trend,
      intent_score_updated_at = now()
  WHERE id = _product_id;

  -- snapshot today's value
  INSERT INTO public.product_intent_history(product_id, retailer_id, snapshot_date, intent_score, sample_size)
  VALUES (_product_id, rid, CURRENT_DATE, score, sample)
  ON CONFLICT (product_id, snapshot_date) DO UPDATE
    SET intent_score = EXCLUDED.intent_score, sample_size = EXCLUDED.sample_size;

  DELETE FROM public.intent_recompute_queue WHERE product_id = _product_id;
END $$;

-- 11. forecast_product_intent -----------------------------------------------
CREATE OR REPLACE FUNCTION public.forecast_product_intent(_product_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  rid uuid;
  cur numeric; s7 numeric; s14 numeric;
  momentum numeric := 0;
  prev_momentum numeric := 0;
  accel numeric := 0;
  p7 numeric; p14 numeric;
  trend text; conf numeric;
  variance numeric;
  sample int;
BEGIN
  SELECT retailer_id, intent_score INTO rid, cur FROM public.products WHERE id = _product_id;
  IF rid IS NULL THEN RETURN; END IF;

  SELECT intent_score INTO s7 FROM public.product_intent_history
    WHERE product_id = _product_id AND snapshot_date <= CURRENT_DATE - 7
    ORDER BY snapshot_date DESC LIMIT 1;
  SELECT intent_score INTO s14 FROM public.product_intent_history
    WHERE product_id = _product_id AND snapshot_date <= CURRENT_DATE - 14
    ORDER BY snapshot_date DESC LIMIT 1;

  IF s7 IS NULL THEN s7 := cur; END IF;
  IF s14 IS NULL THEN s14 := s7; END IF;

  momentum := (cur - s7) / 7.0;
  prev_momentum := (s7 - s14) / 7.0;
  accel := momentum - prev_momentum;

  p7  := cur + momentum * 7 + accel * 3;
  p14 := cur + momentum * 14;
  p7  := LEAST(GREATEST(p7, 0), 100);
  p14 := LEAST(GREATEST(p14, 0), 100);

  IF p7 > cur + 2 THEN trend := 'increase';
  ELSIF p7 < cur - 2 THEN trend := 'decrease';
  ELSE trend := 'stable';
  END IF;

  SELECT COALESCE(VAR_SAMP(intent_score), 0), COUNT(*)
    INTO variance, sample
  FROM public.product_intent_history
  WHERE product_id = _product_id AND snapshot_date >= CURRENT_DATE - 14;

  conf := LEAST(sample::numeric / 14.0, 1) * (1 - LEAST(variance / 400.0, 1));
  conf := LEAST(GREATEST(conf, 0), 1);

  INSERT INTO public.product_intent_forecast
    (product_id, retailer_id, predicted_score_7d, predicted_score_14d, predicted_trend, forecast_confidence, computed_at)
  VALUES (_product_id, rid, p7, p14, trend, conf, now())
  ON CONFLICT (product_id) DO UPDATE SET
    predicted_score_7d = EXCLUDED.predicted_score_7d,
    predicted_score_14d = EXCLUDED.predicted_score_14d,
    predicted_trend = EXCLUDED.predicted_trend,
    forecast_confidence = EXCLUDED.forecast_confidence,
    computed_at = now();
END $$;

-- Backfill: seed signal rows + initial scores for existing products ---------
INSERT INTO public.intent_recompute_queue(product_id)
SELECT id FROM public.products
ON CONFLICT DO NOTHING;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_recommendations;