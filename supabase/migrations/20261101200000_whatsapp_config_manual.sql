-- ============================================================
-- S2-01: Conexão manual do número
-- whatsapp_config ganha a qualidade do número e quando o app foi assinado à
-- WABA; a view segura passa a expor esses campos (nunca o token).
-- O Embedded Signup sai: oauth_state deixa de ser usado.
-- ============================================================

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS quality_rating text,
  ADD COLUMN IF NOT EXISTS webhook_subscribed_at timestamptz;

DROP VIEW IF EXISTS public.whatsapp_config_safe;
CREATE VIEW public.whatsapp_config_safe
WITH (security_invoker = false) AS
  SELECT id, waba_id, phone_number_id, display_phone_number, verified_name,
         quality_rating, webhook_subscribed_at, ativo, created_at, updated_at,
         (vault_secret_id IS NOT NULL) AS token_configurado
  FROM public.whatsapp_config;

REVOKE ALL ON public.whatsapp_config_safe FROM PUBLIC, anon;
GRANT SELECT ON public.whatsapp_config_safe TO authenticated;
