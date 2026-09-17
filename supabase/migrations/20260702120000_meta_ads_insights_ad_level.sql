-- ============================================================
-- Insights do Meta Ads no nível de anúncio (conjunto + criativo)
-- Uma linha por anúncio POR DIA (time_increment=1), espelhando o
-- padrão de meta_ads_cache. Escrita apenas pela Edge Function
-- meta-fetch-insights (service role); frontend só lê.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_ads_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  date_start date,
  date_stop date,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  spend numeric,
  impressions integer,
  clicks integer
);

CREATE INDEX IF NOT EXISTS meta_ads_insights_date_start_idx ON public.meta_ads_insights (date_start);
CREATE INDEX IF NOT EXISTS meta_ads_insights_ad_id_idx ON public.meta_ads_insights (ad_id);

ALTER TABLE public.meta_ads_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select meta_ads_insights" ON public.meta_ads_insights;
CREATE POLICY "Authenticated users can select meta_ads_insights"
  ON public.meta_ads_insights FOR SELECT TO authenticated USING (true);
