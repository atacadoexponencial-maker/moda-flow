
DROP VIEW IF EXISTS meta_config_safe;
CREATE VIEW meta_config_safe AS
SELECT
  id,
  ad_account_id,
  ativo,
  created_at,
  vault_secret_id IS NOT NULL AS token_configurado,
  token_expires_at,
  meta_user_name
FROM meta_config;
