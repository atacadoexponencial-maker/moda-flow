
DROP VIEW IF EXISTS meta_config_safe;

ALTER TABLE meta_config DROP COLUMN IF EXISTS access_token;

CREATE VIEW meta_config_safe AS
SELECT
  id,
  ad_account_id,
  ativo,
  meta_user_name,
  token_expires_at,
  created_at,
  (vault_secret_id IS NOT NULL) AS token_configurado
FROM meta_config;
