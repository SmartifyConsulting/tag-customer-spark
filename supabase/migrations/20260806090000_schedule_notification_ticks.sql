-- Schedules the notification-sweep and daily-summary tick endpoints, which
-- were built (hooks.notifications-tick.ts, hooks.daily-summary.ts) but never
-- actually invoked on a recurring basis — pg_cron/pg_net were enabled in an
-- earlier migration but no job was ever registered, so automations only ever
-- fired on live in-app product edits, never on a sweep or a daily digest.
--
-- IMPORTANT: both routes now check the CRON_SECRET env var (x-cron-secret
-- header) if it's set. The literal value below MUST match the CRON_SECRET
-- env var configured in the live deployment — Postgres cron jobs can't read
-- the Node process's environment, so the shared secret has to be duplicated
-- here. Rotate by updating both the env var and re-running a migration that
-- calls cron.unschedule + cron.schedule with the new value.
--
-- Replace 'd0203edb8ca6e0e1f6c4137eb8f9a9df29b80b9c774fd305762a299aba4f788a'
-- below with your own generated secret if you'd rather not use this one, and
-- set CRON_SECRET to the exact same value in your deployment's env vars.

select cron.schedule(
  'notifications-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://tag-tech.co.za/api/public/hooks/notifications-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'd0203edb8ca6e0e1f6c4137eb8f9a9df29b80b9c774fd305762a299aba4f788a'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 18:00 SAST = 16:00 UTC.
select cron.schedule(
  'daily-summary',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://tag-tech.co.za/api/public/hooks/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'd0203edb8ca6e0e1f6c4137eb8f9a9df29b80b9c774fd305762a299aba4f788a'
    ),
    body := '{}'::jsonb
  );
  $$
);
