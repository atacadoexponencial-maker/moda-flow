-- ============================================================
-- SCHEMA CONSOLIDADO — rode no SQL Editor do Supabase
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- ============================================================
-- TABELA: leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  instagram TEXT,
  status TEXT NOT NULL DEFAULT 'leads_entrada' CHECK (status IN (
    'leads_entrada', 'qualificacao', 'follow_ra', 'reuniao',
    'proposta_negociacao', 'follow_rr', 'follow_futuro', 'contrato',
    'nutricao', 'desqualificado', 'proposta_recusada', 'contrato_assinado'
  )),
  funil TEXT DEFAULT 'SESSÃO ESTRATÉGICA',
  produto TEXT DEFAULT 'AE',
  mql BOOLEAN DEFAULT false,
  sql_flag BOOLEAN DEFAULT false,
  ra_flag BOOLEAN DEFAULT false,
  rr_flag BOOLEAN DEFAULT false,
  data_ultimo_contato DATE,
  data_proximo_contato DATE,
  data_ra DATE,
  data_criada DATE,
  faturamento_mensal TEXT,
  oportunidade NUMERIC DEFAULT 0,
  arrecadado NUMERIC DEFAULT 0,
  loss_reason TEXT,
  justificativa TEXT,
  objetivo TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_content TEXT,
  utm_campaign TEXT,
  utm_posicion TEXT,
  meta_lead_id TEXT,
  meta_ad_id TEXT,
  meta_campaign_id TEXT,
  custom_data JSONB DEFAULT '{}'
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read leads"
  ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete leads"
  ON public.leads FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TABELA: activities
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('note', 'call', 'meeting', 'status_change')),
  content TEXT,
  created_by TEXT
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activities"
  ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activities"
  ON public.activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update activities"
  ON public.activities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete activities"
  ON public.activities FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TABELA: user_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'vendedor')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select user_roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert user_roles"
  ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update user_roles"
  ON public.user_roles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete user_roles"
  ON public.user_roles FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TABELA: meta_config
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ad_account_id TEXT,
  vault_secret_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT false,
  token_expires_at TIMESTAMPTZ,
  meta_user_name TEXT,
  oauth_state TEXT
);

ALTER TABLE public.meta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select meta_config"
  ON public.meta_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update meta_config"
  ON public.meta_config FOR UPDATE TO authenticated USING (true);

CREATE VIEW public.meta_config_safe AS
SELECT
  id, ad_account_id, ativo, meta_user_name, token_expires_at, created_at,
  (vault_secret_id IS NOT NULL) AS token_configurado
FROM public.meta_config;

-- ============================================================
-- TABELA: meta_ads_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meta_ads_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_start DATE,
  date_stop DATE,
  campaign_id TEXT,
  campaign_name TEXT,
  spend NUMERIC,
  impressions INTEGER,
  clicks INTEGER
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

-- ============================================================
-- TABELA: funnel_campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.funnel_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  funil TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  UNIQUE(funil, campaign_id)
);

ALTER TABLE public.funnel_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select funnel_campaigns"
  ON public.funnel_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert funnel_campaigns"
  ON public.funnel_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete funnel_campaigns"
  ON public.funnel_campaigns FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TABELA: webhook_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled BOOLEAN NOT NULL DEFAULT true,
  label TEXT DEFAULT 'Webhook Principal',
  last_used_at TIMESTAMPTZ,
  total_leads_received INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_webhooks"
  ON public.webhook_configs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.webhook_configs (label) VALUES ('Webhook Principal');

CREATE OR REPLACE FUNCTION public.increment_webhook_leads(config_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.webhook_configs
  SET total_leads_received = total_leads_received + 1,
      last_used_at = now()
  WHERE id = config_id;
END;
$$;

-- ============================================================
-- TABELA: lead_field_definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','date','boolean','select')),
  options TEXT[],
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lead_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select lead_field_definitions"
  ON public.lead_field_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert lead_field_definitions"
  ON public.lead_field_definitions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'proprietario')));
CREATE POLICY "Admins can update lead_field_definitions"
  ON public.lead_field_definitions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'proprietario')));
CREATE POLICY "Admins can delete lead_field_definitions"
  ON public.lead_field_definitions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'proprietario')));

INSERT INTO public.lead_field_definitions (key, label, field_type, visible, sort_order, is_system) VALUES
  ('nome',                 'Nome',          'text',    true, 0, true),
  ('entrada',              'Entrada',       'date',    true, 1, true),
  ('status',               'Status',        'select',  true, 2, true),
  ('faturamento_mensal',   'Faturamento',   'select',  true, 3, true),
  ('oportunidade',         'Oportunidade',  'number',  true, 4, true),
  ('data_proximo_contato', 'Próx. Contato', 'date',    true, 5, true),
  ('mql',                  'MQL',           'boolean', true, 6, true),
  ('sql_flag',             'SQL',           'boolean', true, 7, true),
  ('utm_source',           'Fonte',         'text',    true, 8, true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STORAGE: bucket imports
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', false) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VAULT FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.vault_create_secret(new_secret text, new_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE secret_id uuid;
BEGIN
  INSERT INTO vault.secrets (secret, name) VALUES (new_secret, new_name) RETURNING id INTO secret_id;
  RETURN secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_read_secret(secret_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE decrypted text;
BEGIN
  SELECT ds.decrypted_secret INTO decrypted FROM vault.decrypted_secrets ds WHERE ds.id = secret_id;
  RETURN decrypted;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_update_secret(secret_id uuid, new_secret text, new_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE vault.secrets SET secret = new_secret, name = new_name WHERE id = secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_secret(secret_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_read_secret_by_name(secret_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE decrypted text;
BEGIN
  SELECT ds.decrypted_secret INTO decrypted FROM vault.decrypted_secrets ds WHERE ds.name = secret_name LIMIT 1;
  RETURN decrypted;
END;
$$;
