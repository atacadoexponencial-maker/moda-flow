CREATE OR REPLACE FUNCTION public.vault_upsert_secret(p_secret text, p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  secret_id uuid;
BEGIN
  SELECT id INTO secret_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF secret_id IS NOT NULL THEN
    PERFORM vault.update_secret(secret_id, p_secret, p_name);
  ELSE
    secret_id := vault.create_secret(p_secret, p_name);
  END IF;
  RETURN secret_id;
END;
$$;
