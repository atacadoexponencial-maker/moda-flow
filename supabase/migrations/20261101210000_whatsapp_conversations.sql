-- ============================================================
-- S2-02: Conversas e mensagens do WhatsApp (número compartilhado)
--  - uma conversa por lead (whatsapp_conversations.lead_id único);
--  - mensagens com wamid único (idempotência das entregas da Meta);
--  - status de saída só avança (enviado < entregue < lido; falhou só sobre
--    enviando/enviado);
--  - janela de 24h a partir da última mensagem recebida (last_inbound_at);
--  - gravação atômica pelas funções whatsapp_ingest_message e
--    whatsapp_apply_status (só service role, chamadas pelo webhook);
--  - leitura liberada a autenticados (RLS compartilhado) e tempo real;
--  - mídia em bucket privado 'whatsapp-media' (16 MB, SUP-S2-04).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_message_at timestamptz,
  last_message_text text,
  last_message_direction text CHECK (last_message_direction IN ('recebida', 'enviada')),
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_last_message
  ON public.whatsapp_conversations (last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('recebida', 'enviada')),
  type text NOT NULL CHECK (type IN (
    'texto', 'imagem', 'video', 'audio', 'documento', 'figurinha',
    'localizacao', 'contato', 'template', 'desconhecido'
  )),
  content text,
  media_meta_id text,
  media_path text,
  media_mime text,
  media_filename text,
  media_size integer,
  media_status text CHECK (media_status IN ('pendente', 'ok', 'falhou', 'grande_demais')),
  status text CHECK (status IN ('enviando', 'enviado', 'entregue', 'lido', 'falhou')),
  status_error text,
  wamid text UNIQUE,
  reply_to_wamid text,
  reaction_emoji text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_email text,
  phone_number_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation_created
  ON public.whatsapp_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_lead ON public.whatsapp_messages (lead_id);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Authenticated read whatsapp_conversations"
  ON public.whatsapp_conversations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated read whatsapp_messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_wa_conversations_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER trg_wa_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tempo real (SUP-S2-06)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------
-- Ordem dos status de saída
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'enviando' THEN 0
    WHEN 'enviado' THEN 1
    WHEN 'entregue' THEN 2
    WHEN 'lido' THEN 3
    ELSE -1
  END;
$$;

-- ------------------------------------------------------------
-- Gravação de mensagem recebida (atômica e idempotente)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_ingest_message(
  p_phone_number_id text,
  p_from text,
  p_profile_name text,
  p_wamid text,
  p_type text,
  p_content text,
  p_media jsonb,
  p_reply_to_wamid text,
  p_ts timestamptz,
  p_preview text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalize_whatsapp(p_from);
  v_lead_id uuid;
  v_lead_created boolean := false;
  v_conv_id uuid;
  v_msg_id uuid;
  v_counts boolean := p_type <> 'desconhecido';
BEGIN
  IF v_norm IS NULL THEN
    RAISE EXCEPTION 'Telefone de origem inválido: %', p_from;
  END IF;

  -- Já registrada? (entrega repetida da Meta)
  SELECT id, conversation_id, lead_id INTO v_msg_id, v_conv_id, v_lead_id
  FROM public.whatsapp_messages WHERE wamid = p_wamid;
  IF v_msg_id IS NOT NULL THEN
    RETURN jsonb_build_object('message_id', v_msg_id, 'conversation_id', v_conv_id,
      'lead_id', v_lead_id, 'created', false, 'lead_created', false);
  END IF;

  -- Lead pelo telefone normalizado (mesma regra da deduplicação)
  SELECT id INTO v_lead_id FROM public.leads
  WHERE whatsapp_norm = v_norm ORDER BY created_at ASC, id ASC LIMIT 1;

  IF v_lead_id IS NULL THEN
    -- PER-S2-01: telefone desconhecido vira lead em Leads de Entrada, funil "whatsapp".
    INSERT INTO public.leads (nome, whatsapp, funil, status, created_at)
    VALUES (COALESCE(NULLIF(btrim(p_profile_name), ''), p_from), p_from, 'whatsapp', 'leads_entrada', COALESCE(p_ts, now()))
    RETURNING id INTO v_lead_id;
    v_lead_created := v_lead_id IS NOT NULL;
    IF v_lead_id IS NULL THEN
      -- outra mensagem criou o lead em paralelo: a deduplicação descartou este insert
      SELECT id INTO v_lead_id FROM public.leads
      WHERE whatsapp_norm = v_norm ORDER BY created_at ASC, id ASC LIMIT 1;
    END IF;
  END IF;

  -- Reação: atualiza a mensagem alvo, sem criar mensagem nem contar não lida
  IF p_type = 'reacao' THEN
    UPDATE public.whatsapp_messages SET reaction_emoji = NULLIF(p_content, '')
    WHERE wamid = p_reply_to_wamid;
    RETURN jsonb_build_object('message_id', NULL, 'conversation_id', NULL,
      'lead_id', v_lead_id, 'created', false, 'lead_created', v_lead_created);
  END IF;

  INSERT INTO public.whatsapp_conversations (lead_id)
  VALUES (v_lead_id)
  ON CONFLICT (lead_id) DO NOTHING;
  SELECT id INTO v_conv_id FROM public.whatsapp_conversations WHERE lead_id = v_lead_id;

  INSERT INTO public.whatsapp_messages (
    conversation_id, lead_id, direction, type, content, wamid, reply_to_wamid,
    media_meta_id, media_mime, media_filename, media_status, phone_number_id, created_at
  ) VALUES (
    v_conv_id, v_lead_id, 'recebida', p_type, p_content, p_wamid, p_reply_to_wamid,
    p_media ->> 'id', p_media ->> 'mime_type', p_media ->> 'filename',
    CASE WHEN p_media IS NULL THEN NULL ELSE 'pendente' END,
    p_phone_number_id, COALESCE(p_ts, now())
  )
  ON CONFLICT (wamid) DO NOTHING
  RETURNING id INTO v_msg_id;

  IF v_msg_id IS NULL THEN
    SELECT id INTO v_msg_id FROM public.whatsapp_messages WHERE wamid = p_wamid;
    RETURN jsonb_build_object('message_id', v_msg_id, 'conversation_id', v_conv_id,
      'lead_id', v_lead_id, 'created', false, 'lead_created', v_lead_created);
  END IF;

  UPDATE public.whatsapp_conversations
  SET unread_count = unread_count + CASE WHEN v_counts THEN 1 ELSE 0 END,
      last_inbound_at = GREATEST(COALESCE(last_inbound_at, 'epoch'::timestamptz), COALESCE(p_ts, now())),
      last_message_at = CASE WHEN last_message_at IS NULL OR COALESCE(p_ts, now()) >= last_message_at
                             THEN COALESCE(p_ts, now()) ELSE last_message_at END,
      last_message_text = CASE WHEN last_message_at IS NULL OR COALESCE(p_ts, now()) >= last_message_at
                               THEN p_preview ELSE last_message_text END,
      last_message_direction = CASE WHEN last_message_at IS NULL OR COALESCE(p_ts, now()) >= last_message_at
                                    THEN 'recebida' ELSE last_message_direction END
  WHERE id = v_conv_id;

  RETURN jsonb_build_object('message_id', v_msg_id, 'conversation_id', v_conv_id,
    'lead_id', v_lead_id, 'created', true, 'lead_created', v_lead_created);
END;
$$;

-- ------------------------------------------------------------
-- Status de mensagem enviada (só avança)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_apply_status(
  p_wamid text,
  p_status text,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_status = 'falhou' THEN
    UPDATE public.whatsapp_messages
    SET status = 'falhou', status_error = COALESCE(p_error, status_error)
    WHERE wamid = p_wamid AND direction = 'enviada'
      AND (status IS NULL OR status IN ('enviando', 'enviado'));
  ELSE
    UPDATE public.whatsapp_messages
    SET status = p_status
    WHERE wamid = p_wamid AND direction = 'enviada'
      AND public.whatsapp_status_rank(p_status) > public.whatsapp_status_rank(COALESCE(status, 'enviando'))
      AND COALESCE(status, '') <> 'falhou';
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_ingest_message(text, text, text, text, text, text, jsonb, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ingest_message(text, text, text, text, text, text, jsonb, text, timestamptz, text) TO service_role;
REVOKE ALL ON FUNCTION public.whatsapp_apply_status(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_apply_status(text, text, text) TO service_role;

-- ------------------------------------------------------------
-- Bucket privado de mídia
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('whatsapp-media', 'whatsapp-media', false, 16777216)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "whatsapp_media_select" ON storage.objects;
CREATE POLICY "whatsapp_media_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'whatsapp-media');
DROP POLICY IF EXISTS "whatsapp_media_insert" ON storage.objects;
CREATE POLICY "whatsapp_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media');
