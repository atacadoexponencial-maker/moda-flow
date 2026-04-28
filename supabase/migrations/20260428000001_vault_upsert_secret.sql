CREATE OR REPLACE FUNCTION public.vault_upsert_secret(p_secret text, p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  secret_id uuid;
BEGIN
  SELECT id INTO secret_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF secret_id IS NOT NULL THEN
    UPDATE vault.secrets SET secret = p_secret WHERE id = secret_id;
  ELSE
    INSERT INTO vault.secrets (secret, name) VALUES (p_secret, p_name) RETURNING id INTO secret_id;
  END IF;
  RETURN secret_id;
END;
$$;
