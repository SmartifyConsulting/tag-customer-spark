-- A3 fix: recompute_product_intent()'s conv_rate (the Interest Score's
-- "conversion rate" input, weighted 20% by default — the single largest
-- weight in the whole score) counted every sales_recoveries row for a
-- product, regardless of status. Same bug family as the Revenue/Sales
-- recovered fix in the previous migration: a customer tapping
-- "Collection"/"Delivery" creates a 'pending' row before any staff member
-- verifies the sale happened, and a row staff explicitly rejected was
-- never excluded either. Only 'attributed' (staff-confirmed) rows should
-- count as a conversion.
--
-- Everything else in this function is unchanged from its previous
-- definition — this migration only touches the conv_rate subquery's WHERE
-- clause. See that migration's header for the other three flagged
-- signals (time-on-page, add-to-cart, price-impact) which were reviewed
-- but deliberately left as-is this pass.
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

  -- conversion = confirmed recoveries / unique viewers. Only status =
  -- 'attributed' (a staff member clicked "Confirm sale") counts — a
  -- 'pending' tap or a staff-'rejected' one is not a conversion.
  conv_rate := CASE WHEN scans_unique > 0 THEN
    (SELECT COUNT(*)::numeric FROM public.sales_recoveries
       WHERE product_id = _product_id
         AND status = 'attributed'
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

-- Existing scores were computed with the old (unfiltered) conv_rate, so
-- they're stale relative to this fix until each product's next scheduled
-- recompute. Queue every product with at least one sales_recoveries row
-- for an immediate recompute rather than waiting for the normal cadence.
INSERT INTO public.intent_recompute_queue (product_id)
SELECT DISTINCT product_id FROM public.sales_recoveries
WHERE product_id IS NOT NULL
ON CONFLICT DO NOTHING;
