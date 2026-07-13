-- Captures the fulfillment choice a customer makes when they tap
-- "Collection" or "Delivery" on a price/stock alert — the signal that turns
-- a customer_interests row into a real purchase-intent (sales_recoveries,
-- status 'pending', confirmed/rejected later once the sale actually happens).
ALTER TABLE public.sales_recoveries
  ADD COLUMN IF NOT EXISTS fulfillment text;
