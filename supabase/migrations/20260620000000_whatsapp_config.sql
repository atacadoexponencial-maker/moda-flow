-- Migration: whatsapp_config (linha única, espelhando meta_config)
-- Armazena a configuração do WhatsApp. O token nunca é guardado em texto puro:
-- apenas a referência vault_secret_id ao segredo no Vault.
-- Espelha o padrão de meta_config (20260310083344_*.sql), a view segura e o
-- GRANT (20260424000000_* / 20260428000000_*).

-- Tabela base (token referenciado pelo vault_secret_id, nunca em texto puro)
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_secret_id uuid,
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  verified_name text,
  ativo boolean NOT NULL DEFAULT false,
  oauth_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS habilitado SEM policy de SELECT direto para authenticated na tabela base.
-- Espelha a intenção de segurança do Vault: o frontend lê apenas via view segura;
-- a tabela base fica acessível somente pelo backend (service role).
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- View segura para o frontend (sem expor segredos: vault_secret_id e oauth_state ficam de fora)
CREATE VIEW public.whatsapp_config_safe AS
  SELECT id, waba_id, phone_number_id, display_phone_number, verified_name, ativo, created_at,
         (vault_secret_id IS NOT NULL) AS token_configurado
  FROM public.whatsapp_config;

GRANT SELECT ON public.whatsapp_config_safe TO authenticated;

-- Função reutilizável de trigger para manter updated_at (não existia no schema)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
