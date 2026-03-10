
-- Enable vault extension
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Helper function to create a secret in the vault
CREATE OR REPLACE FUNCTION public.vault_create_secret(new_secret text, new_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret_id uuid;
BEGIN
  INSERT INTO vault.secrets (secret, name)
  VALUES (new_secret, new_name)
  RETURNING id INTO secret_id;
  RETURN secret_id;
END;
$$;

-- Helper function to read a decrypted secret from the vault
CREATE OR REPLACE FUNCTION public.vault_read_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decrypted text;
BEGIN
  SELECT ds.decrypted_secret INTO decrypted
  FROM vault.decrypted_secrets ds
  WHERE ds.id = secret_id;
  RETURN decrypted;
END;
$$;

-- Helper function to update a secret in the vault
CREATE OR REPLACE FUNCTION public.vault_update_secret(secret_id uuid, new_secret text, new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE vault.secrets
  SET secret = new_secret, name = new_name
  WHERE id = secret_id;
END;
$$;
