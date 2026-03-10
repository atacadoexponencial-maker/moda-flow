
-- Tabela meta_config (token referenciado pelo vault_secret_id, nunca em texto puro)
CREATE TABLE public.meta_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ad_account_id text,
  vault_secret_id uuid,
  ativo boolean NOT NULL DEFAULT false
);

ALTER TABLE public.meta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select meta_config"
  ON public.meta_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update meta_config"
  ON public.meta_config FOR UPDATE TO authenticated USING (true);

-- View segura para o frontend (sem expor segredos)
CREATE VIEW public.meta_config_safe AS
  SELECT id, created_at, ad_account_id, ativo,
         CASE WHEN vault_secret_id IS NOT NULL THEN true ELSE false END AS token_configurado
  FROM public.meta_config;

-- Tabela meta_ads_cache
CREATE TABLE public.meta_ads_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  date_start date,
  date_stop date,
  campaign_id text,
  campaign_name text,
  spend numeric,
  impressions integer,
  clicks integer,
  leads integer
);

ALTER TABLE public.meta_ads_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select meta_ads_cache"
  ON public.meta_ads_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert meta_ads_cache"
  ON public.meta_ads_cache FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update meta_ads_cache"
  ON public.meta_ads_cache FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete meta_ads_cache"
  ON public.meta_ads_cache FOR DELETE TO authenticated USING (true);
