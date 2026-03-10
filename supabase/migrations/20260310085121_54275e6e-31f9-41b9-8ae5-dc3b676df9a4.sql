
ALTER TABLE meta_config ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE meta_config ADD COLUMN IF NOT EXISTS meta_user_name text;
ALTER TABLE meta_config ADD COLUMN IF NOT EXISTS oauth_state text;
