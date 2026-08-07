CREATE OR REPLACE FUNCTION public.tg_watchlist_on_product_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
                jsonb_build_object('new_price_cents', NEW.sale_price_cents, 'old_price_cents', COALESCE(OLD.sale_price_cents, OLD.price_cents)));
      UPDATE public.watchlists
        SET last_fired_at = now(), fired_count = fired_count + 1
        WHERE id = w.id;
    END LOOP;
  END IF;

  IF COALESCE(OLD.stock_qty,0) = 0 AND COALESCE(NEW.stock_qty,0) > 0 THEN
    FOR w IN SELECT * FROM public.watchlists
      WHERE product_id = NEW.id AND status = 'active' AND trigger IN ('back_in_stock','any_update')
    LOOP
      INSERT INTO public.watchlist_events(watchlist_id, retailer_id, trigger, payload)
        VALUES (w.id, w.retailer_id, 'back_in_stock', jsonb_build_object('stock_qty', NEW.stock_qty));
      UPDATE public.watchlists
        SET last_fired_at = now(), fired_count = fired_count + 1
        WHERE id = w.id;
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
      UPDATE public.watchlists
        SET last_fired_at = now(), fired_count = fired_count + 1
        WHERE id = w.id;
    END LOOP;
  END IF;

  RETURN NEW;
END
$function$;

UPDATE public.watchlists w
SET status = 'active', notifications_enabled = true, updated_at = now()
FROM public.customers c
WHERE w.customer_id = c.id
  AND w.status = 'fired'
  AND w.notifications_enabled = true
  AND c.status = 'subscribed'
  AND c.notify_consent_at IS NOT NULL;