-- ============================================================
-- Sub-projeto 2: Mesclagem do histórico + backfill de touches
-- Operação única sobre os leads já existentes:
--  - agrupa por identidade (whatsapp_norm; senão email_norm; senão o
--    próprio id, para não agrupar leads sem chave entre si);
--  - elege o lead mais antigo de cada grupo como sobrevivente (origem);
--  - cria um touch por lead existente, no sobrevivente do grupo
--    (o mais antigo = aquisição; os demais = retorno);
--  - reatribui atividades dos não-sobreviventes ao sobrevivente;
--  - remove os leads não-sobreviventes (duplicados);
--  - cria os índices ÚNICOS de identidade (agora sem duplicados).
-- ============================================================

-- Ranking dos leads dentro de cada grupo de identidade.
CREATE TEMP TABLE _ranked ON COMMIT DROP AS
SELECT
  id, created_at, funil, utm_source, utm_medium, utm_campaign, utm_content,
  utm_term, utm_posicion, meta_campaign_id, meta_ad_id, meta_lead_id,
  external_id, fbc, gclid,
  COALESCE(whatsapp_norm, email_norm, id::text) AS grp,
  ROW_NUMBER() OVER (
    PARTITION BY COALESCE(whatsapp_norm, email_norm, id::text)
    ORDER BY created_at ASC, id ASC
  ) AS rn
FROM public.leads;

CREATE TEMP TABLE _survivor ON COMMIT DROP AS
SELECT grp, id AS survivor_id FROM _ranked WHERE rn = 1;

-- Cria um touch por lead existente, no sobrevivente do grupo.
INSERT INTO public.lead_touches (
  lead_id, created_at, funil, utm_source, utm_medium, utm_campaign,
  utm_content, utm_term, utm_posicion, meta_campaign_id, meta_ad_id,
  meta_lead_id, external_id, fbc, gclid, is_aquisicao
)
SELECT s.survivor_id, r.created_at, r.funil, r.utm_source, r.utm_medium,
       r.utm_campaign, r.utm_content, r.utm_term, r.utm_posicion,
       r.meta_campaign_id, r.meta_ad_id, r.meta_lead_id, r.external_id,
       r.fbc, r.gclid, (r.rn = 1)
FROM _ranked r
JOIN _survivor s USING (grp);

-- Reatribui atividades dos não-sobreviventes ao sobrevivente.
UPDATE public.activities a
SET lead_id = s.survivor_id
FROM _ranked r
JOIN _survivor s USING (grp)
WHERE r.rn > 1 AND a.lead_id = r.id;

-- Remove os leads não-sobreviventes (duplicados).
DELETE FROM public.leads
WHERE id IN (SELECT id FROM _ranked WHERE rn > 1);

-- Substitui os índices de lookup por índices ÚNICOS de identidade.
DROP INDEX IF EXISTS public.idx_leads_whatsapp_norm;
DROP INDEX IF EXISTS public.idx_leads_email_norm;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_whatsapp_norm
  ON public.leads (whatsapp_norm) WHERE whatsapp_norm IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_email_norm
  ON public.leads (email_norm) WHERE whatsapp_norm IS NULL AND email_norm IS NOT NULL;
