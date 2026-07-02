-- Tier system: introduce Starter/Pro/Enterprise on retailers
CREATE TYPE public.tag_tier AS ENUM ('starter', 'pro', 'enterprise');

ALTER TABLE public.retailers
  ADD COLUMN tier public.tag_tier NOT NULL DEFAULT 'starter';

-- Backfill existing demo retailers to enterprise so dev users keep seeing everything
UPDATE public.retailers SET tier = 'enterprise';
