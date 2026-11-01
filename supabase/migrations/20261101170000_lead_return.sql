-- ============================================================
-- S1-06: Retorno de lead
-- Quando a deduplicação registra um touch de RETORNO:
--  - lead em estágio perdido (desqualificado, proposta_recusada), em Nutrição
--    ou em Follow-up Futuro volta para Leads de Entrada (PER-S1-01), perde o
--    próximo contato agendado e o motivo de perda (que fica guardado no
--    registro da linha do tempo); o responsável é mantido;
--  - lead em trabalho ou fechado fica onde está;
--  - em todos os casos: activities recebe 'lead_voltou' com funil e origem, e
--    leads.last_return_at marca o retorno (selo "Voltou" por 7 dias, SUP-S1-03).
-- Retornos anteriores a esta migration não são marcados (CA-S1-26): a coluna
-- nasce nula e só o trigger a preenche.
-- ============================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_return_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_last_return_at
  ON public.leads (last_return_at) WHERE last_return_at IS NOT NULL;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_type_check
  CHECK (type IN ('note', 'call', 'meeting', 'status_change', 'assignment', 'lead_voltou'));

-- Estágios que reabrem no retorno
CREATE OR REPLACE FUNCTION public.lead_return_reopens(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN ('desqualificado', 'proposta_recusada', 'nutricao', 'follow_futuro');
$$;

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
  v_existing public.leads%ROWTYPE;
  v_origem TEXT;
  v_content TEXT;
  v_stage_labels CONSTANT jsonb := '{
    "leads_entrada": "Leads de Entrada", "qualificacao": "Qualificação",
    "follow_ra": "Follow-up RA", "reuniao": "Reunião",
    "proposta_negociacao": "Proposta / Negociação", "follow_rr": "Follow-up RR",
    "follow_futuro": "Follow-up Futuro", "contrato": "Contrato", "nutricao": "Nutrição",
    "desqualificado": "Desqualificado", "proposta_recusada": "Proposta Recusada",
    "contrato_assinado": "Contrato Assinado"
  }'::jsonb;
BEGIN
  v_wa    := public.normalize_whatsapp(NEW.whatsapp);
  v_email := public.normalize_email(NEW.email);

  NEW.whatsapp_norm := v_wa;
  NEW.email_norm    := v_email;

  v_key := COALESCE(v_wa, v_email);
  IF v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key)::bigint);

  IF v_wa IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.leads
    WHERE whatsapp_norm = v_wa
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  ELSE
    SELECT * INTO v_existing FROM public.leads
    WHERE email_norm = v_email
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    -- 1. Touch de RETORNO (como antes)
    INSERT INTO public.lead_touches (
      lead_id, created_at, funil, utm_source, utm_medium, utm_campaign,
      utm_content, utm_term, utm_posicion, meta_campaign_id, meta_ad_id,
      meta_lead_id, external_id, fbc, gclid, is_aquisicao
    ) VALUES (
      v_existing.id, COALESCE(NEW.created_at, now()), NEW.funil, NEW.utm_source,
      NEW.utm_medium, NEW.utm_campaign, NEW.utm_content, NEW.utm_term,
      NEW.utm_posicion, NEW.meta_campaign_id, NEW.meta_ad_id, NEW.meta_lead_id,
      NEW.external_id, NEW.fbc, NEW.gclid, false
    );

    -- 2. Registro na linha do tempo: funil e origem da nova entrada
    v_origem := concat_ws(' / ', NULLIF(NEW.utm_source, ''), NULLIF(NEW.utm_campaign, ''));
    v_content := 'Lead voltou pelo funil ' || COALESCE(NULLIF(NEW.funil, ''), '(sem funil)');
    IF v_origem <> '' THEN
      v_content := v_content || ' (' || v_origem || ')';
    END IF;

    -- 3. Reabrir quando perdido, em Nutrição ou em Follow-up Futuro
    IF public.lead_return_reopens(v_existing.status) THEN
      v_content := v_content
        || ' · reaberto de ' || COALESCE(v_stage_labels ->> v_existing.status, v_existing.status)
        || ' para Leads de Entrada';
      IF v_existing.loss_reason IS NOT NULL AND btrim(v_existing.loss_reason) <> '' THEN
        v_content := v_content || ' · motivo de perda anterior: ' || v_existing.loss_reason;
      END IF;

      UPDATE public.leads
      SET status = 'leads_entrada',
          loss_reason = NULL,
          data_proximo_contato = NULL,
          last_return_at = now()
      WHERE id = v_existing.id;
    ELSE
      UPDATE public.leads
      SET last_return_at = now()
      WHERE id = v_existing.id;
    END IF;

    INSERT INTO public.activities (lead_id, type, content)
    VALUES (v_existing.id, 'lead_voltou', v_content);

    RETURN NULL; -- não cria o contato duplicado
  END IF;

  RETURN NEW;
END;
$$;
