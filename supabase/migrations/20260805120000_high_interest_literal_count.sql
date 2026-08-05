-- The "high_interest" automation now fires on a literal count of other
-- customers actively interested in the same product (>= threshold, default
-- 1), instead of the derived Intent Score. Needs its own snapshot column so
-- the rule can re-arm correctly (fire again once the count drops back below
-- threshold and later rises again), same pattern as last_known_intent_score.
ALTER TABLE public.watchlists
  ADD COLUMN IF NOT EXISTS last_known_interest_count integer;

-- Existing "High interest" automation settings default to the old
-- Intent-Score threshold (75) — reset to the new literal-count default (1)
-- for any retailer who never explicitly customised it themselves. A
-- customised threshold (anything other than the old default) is left alone.
UPDATE public.automation_settings
SET threshold = 1
WHERE automation_key = 'high_interest' AND threshold = 75;
