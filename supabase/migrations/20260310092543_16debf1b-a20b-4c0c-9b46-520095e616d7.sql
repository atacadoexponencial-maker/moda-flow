
CREATE OR REPLACE FUNCTION public.vault_read_secret_by_name(secret_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  decrypted text;
BEGIN
  SELECT ds.decrypted_secret INTO decrypted
  FROM vault.decrypted_secrets ds
  WHERE ds.name = secret_name
  LIMIT 1;
  RETURN decrypted;
END;
$$;
