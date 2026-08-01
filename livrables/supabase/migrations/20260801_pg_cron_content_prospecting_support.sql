-- pg_cron: Content, Prospecting, Support heartbeats quotidiens
-- Task 4 — Audit Fixes P0 (2026-08-01)
--
-- Observation Step 1: Marketing-heartbeat utilise token publié hardcodé
-- Format: net.http_post avec Authorization Bearer sb_publishable_...
-- Body: {"run_type":"heartbeat"} (pas "daily")
--
-- Stratégie: Recréer les 3 jobs avec le pattern confirmé qui fonctionne en production

-- Retirer les anciens jobs s'ils existent (idempotent)
SELECT cron.unschedule('content-heartbeat-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'content-heartbeat-daily'
);

SELECT cron.unschedule('prospecting-heartbeat-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'prospecting-heartbeat-daily'
);

SELECT cron.unschedule('support-heartbeat-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'support-heartbeat-daily'
);

-- Content Employee — 12h30 UTC chaque jour
SELECT cron.schedule(
  'content-heartbeat-daily',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/content-heartbeat',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei"}'::jsonb,
    body := '{"run_type":"heartbeat"}'::jsonb
  );
  $$
);

-- Prospecting Employee — 13h00 UTC chaque jour
SELECT cron.schedule(
  'prospecting-heartbeat-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/prospecting-heartbeat',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei"}'::jsonb,
    body := '{"run_type":"heartbeat"}'::jsonb
  );
  $$
);

-- Support Agent — 13h30 UTC chaque jour
SELECT cron.schedule(
  'support-heartbeat-daily',
  '30 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/support-heartbeat',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei"}'::jsonb,
    body := '{"run_type":"heartbeat"}'::jsonb
  );
  $$
);
