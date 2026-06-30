-- ============================================================
-- Auto-sync diário do Meta Ads
-- Agenda a função meta-fetch-insights para rodar todo dia, sem usuário
-- logado (autenticada pelo segredo de cron guardado no Vault).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior (se existir) para ser idempotente.
DO $$
BEGIN
  PERFORM cron.unschedule('meta-ads-daily-sync');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Roda às 08:00 UTC (05:00 BRT) todos os dias.
SELECT cron.schedule(
  'meta-ads-daily-sync',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ynjxvzjomizfyabupvne.supabase.co/functions/v1/meta-fetch-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inluanh2empvbWl6ZnlhYnVwdm5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzk1NTMsImV4cCI6MjA4ODY1NTU1M30.VyOQKzEwIuIceL0NFzOdmOU3EbkCdF2ovL5-ZhvzAOU',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
