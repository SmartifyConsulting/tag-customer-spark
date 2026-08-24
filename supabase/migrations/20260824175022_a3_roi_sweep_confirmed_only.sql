-- A3 fix: run_roi_attribution_sweep() previously processed every
-- sales_recoveries row regardless of status, so a customer's tap on a
-- WhatsApp "Collection"/"Delivery" quick reply (status 'pending' at
-- insert — see webhooks/infobip.ts) turned into recognised revenue in
-- roi_attributions before any staff member confirmed the sale happened,
-- and a row a staff member explicitly rejected was never excluded either.
-- This reissues the same function with one added condition: only sweep
-- rows a staff member has confirmed via "Confirm sale" (roi.functions.ts
-- resolvePendingRecovery, action "confirm" -> status 'attributed').
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
    WHERE a.id IS NULL
      AND s.status = 'attributed'
      AND (_retailer_id IS NULL OR s.retailer_id = _retailer_id)
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
       best_notif.campaign_id, best_notif.notification_id, best_scan.qr_tag_id, best_watch.watchlist_id,
       touch, 'last_touch', revenue, margin, cost)
    ON CONFLICT (sales_recovery_id) DO NOTHING;

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- Any roi_attributions rows already created from a pending/rejected
-- sales_recovery before this fix are now stale — the sweep only ever
-- inserts once per sales_recovery (ON CONFLICT DO NOTHING keyed on
-- sales_recovery_id), so a bad row from before this migration would
-- otherwise sit there forever, permanently overstating recovered revenue.
DELETE FROM public.roi_attributions a
USING public.sales_recoveries s
WHERE a.sales_recovery_id = s.id
  AND s.status <> 'attributed';
