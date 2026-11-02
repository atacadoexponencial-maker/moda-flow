-- ============================================================
-- S2-03: Templates do WhatsApp sincronizados da Meta
-- Cópia local dos templates da conta (WABA) para listar, escolher no envio e
-- usar nas automações. Criação e aprovação continuam no WhatsApp Manager.
-- Escrita só pela Edge Function de sincronização (service role).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id text NOT NULL UNIQUE,
  name text NOT NULL,
  language text NOT NULL,
  category text,
  status text NOT NULL,
  rejected_reason text,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read whatsapp_templates" ON public.whatsapp_templates;
CREATE POLICY "Authenticated read whatsapp_templates"
  ON public.whatsapp_templates FOR SELECT TO authenticated USING (true);
