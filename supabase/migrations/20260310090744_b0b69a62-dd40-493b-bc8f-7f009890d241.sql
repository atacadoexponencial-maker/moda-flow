ALTER TABLE meta_config ADD COLUMN IF NOT EXISTS access_token text;
DROP VIEW IF EXISTS meta_config_safe;
CREATE VIEW meta_config_safe AS
SELECT
  id,
  ad_account_id,
  ativo,
  meta_user_name,
  token_expires_at,
  created_at,
  (access_token IS NOT NULL AND access_token != '') AS token_configurado
FROM meta_config;