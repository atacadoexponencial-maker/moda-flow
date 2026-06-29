-- ============================================================
-- Sub-projeto 1: Touches + Dedup na entrada (fundação)
-- Cria a tabela lead_touches, colunas normalizadas de identidade,
-- a função única de normalização e os triggers que centralizam a
-- deduplicação no banco (valem para QUALQUER ponto de criação de lead:
-- webhook, importação na tela e criação manual).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela lead_touches (uma submissão por linha)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  funil TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  utm_posicion TEXT,
  meta_campaign_id TEXT,
  meta_ad_id TEXT,
  meta_lead_id TEXT,
  external_id TEXT,
  fbc TEXT,
  gclid TEXT,
  is_aquisicao BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_lead_touches_lead_id ON public.lead_touches (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_touches_created_at ON public.lead_touches (created_at);

ALTER TABLE public.lead_touches ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para usuários autenticados (touches são criados apenas
-- pelos triggers abaixo, que rodam como SECURITY DEFINER).
CREATE POLICY "Authenticated users can read lead_touches"
  ON public.lead_touches FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- 2. Colunas normalizadas de identidade no contato (leads)
-- ------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_norm TEXT,
  ADD COLUMN IF NOT EXISTS email_norm TEXT;

-- ------------------------------------------------------------
-- 3. Função única de normalização de identidade
-- ------------------------------------------------------------
-- WhatsApp: só dígitos; remove o DDI 55 quando presente (12 ou 13 dígitos).
CREATE OR REPLACE FUNCTION public.normalize_whatsapp(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    WHEN length(d) IN (12, 13) AND left(d, 2) = '55' THEN substr(d, 3)
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(raw, ''), '\D', '', 'g') AS d) s;
$$;

-- Email: minúsculas e sem espaços nas pontas.
CREATE OR REPLACE FUNCTION public.normalize_email(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(btrim(coalesce(raw, ''))), '');
$$;

-- ------------------------------------------------------------
-- 4. Backfill das colunas normalizadas nos contatos existentes
-- ------------------------------------------------------------
UPDATE public.leads
SET whatsapp_norm = public.normalize_whatsapp(whatsapp),
    email_norm    = public.normalize_email(email);

-- Índices de lookup (NÃO únicos: duplicados históricos ainda existem;
-- a unicidade entra no sub-projeto 2, após a mesclagem).
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_norm
  ON public.leads (whatsapp_norm) WHERE whatsapp_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email_norm
  ON public.leads (email_norm) WHERE email_norm IS NOT NULL;

-- ------------------------------------------------------------
-- 5. Trigger BEFORE INSERT: deduplicação central
-- ------------------------------------------------------------
-- Normaliza a identidade, procura o contato mais antigo com a mesma chave
-- (WhatsApp primeiro; senão email) e, se existir, registra um touch de
-- RETORNO descartando o insert do contato duplicado. Caso contrário, segue
-- a criação normal (o trigger AFTER cria o primeiro touch de aquisição).
CREATE OR REPLACE FUNCTION public.fn_leads_dedup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wa     TEXT;
  v_email  TEXT;
  v_key    TEXT;
  v_existing_id UUID;
BEGIN
  v_wa    := public.normalize_whatsapp(NEW.whatsapp);
  v_email := public.normalize_email(NEW.email);

  -- Guarda o retrato normalizado na própria linha do contato.
  NEW.whatsapp_norm := v_wa;
  NEW.email_norm    := v_email;

  -- Chave de identidade: WhatsApp tem prioridade; email é fallback.
  v_key := COALESCE(v_wa, v_email);

  -- Sem identidade -> não dá para deduplicar; trata como contato novo.
  IF v_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serializa criações concorrentes da mesma identidade (evita 2 contatos).
  PERFORM pg_advisory_xact_lock(hashtext(v_key)::bigint);

  -- Procura o contato existente mais antigo (a origem).
  IF v_wa IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.leads
    WHERE whatsapp_norm = v_wa
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  ELSE
    SELECT id INTO v_existing_id FROM public.leads
    WHERE email_norm = v_email
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Contato já existe: registra touch de RETORNO e descarta o duplicado.
    INSERT INTO public.lead_touches (
      lead_id, created_at, funil, utm_source, utm_medium, utm_campaign,
      utm_content, utm_term, utm_posicion, meta_campaign_id, meta_ad_id,
      meta_lead_id, external_id, fbc, gclid, is_aquisicao
    ) VALUES (
      v_existing_id, COALESCE(NEW.created_at, now()), NEW.funil, NEW.utm_source,
      NEW.utm_medium, NEW.utm_campaign, NEW.utm_content, NEW.utm_term,
      NEW.utm_posicion, NEW.meta_campaign_id, NEW.meta_ad_id, NEW.meta_lead_id,
      NEW.external_id, NEW.fbc, NEW.gclid, false
    );
    RETURN NULL; -- não cria o contato duplicado
  END IF;

  -- Contato novo: segue a criação (AFTER trigger adiciona o 1º touch).
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_dedup ON public.leads;
CREATE TRIGGER trg_leads_dedup
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_leads_dedup();

-- ------------------------------------------------------------
-- 6. Trigger AFTER INSERT: primeiro touch (aquisição)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_leads_first_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lead_touches (
    lead_id, created_at, funil, utm_source, utm_medium, utm_campaign,
    utm_content, utm_term, utm_posicion, meta_campaign_id, meta_ad_id,
    meta_lead_id, external_id, fbc, gclid, is_aquisicao
  ) VALUES (
    NEW.id, COALESCE(NEW.created_at, now()), NEW.funil, NEW.utm_source,
    NEW.utm_medium, NEW.utm_campaign, NEW.utm_content, NEW.utm_term,
    NEW.utm_posicion, NEW.meta_campaign_id, NEW.meta_ad_id, NEW.meta_lead_id,
    NEW.external_id, NEW.fbc, NEW.gclid, true
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_first_touch ON public.leads;
CREATE TRIGGER trg_leads_first_touch
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_leads_first_touch();
