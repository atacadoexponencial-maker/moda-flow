-- ============================================================
-- Segurança: fecha as funções auxiliares do Vault.
-- As funções vault_* são SECURITY DEFINER e estavam executáveis por anon e
-- authenticated (privilégio padrão de PUBLIC). Com a chave pública do
-- frontend era possível ler qualquer segredo, inclusive pelo nome
-- (vault_read_secret_by_name). Só as Edge Functions (service role) usam essas
-- funções; o cron e os triggers leem vault.decrypted_secrets diretamente.
-- ============================================================

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'vault_create_secret', 'vault_delete_secret', 'vault_read_secret',
        'vault_read_secret_by_name', 'vault_update_secret', 'vault_upsert_secret'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
