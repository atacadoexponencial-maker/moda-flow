-- ============================================================
-- S1-05 (ajuste): remoção do objeto via API do Storage
-- A plataforma bloqueia DELETE direto em storage.objects ("Direct deletion from
-- storage tables is not allowed. Use the Storage API instead."). O trigger
-- passa a chamar a API do Storage pelo pg_net, autenticado com a service role
-- guardada no Vault (segredo 'service_role_key'). A chamada é assíncrona.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.fn_activity_attachments_remove_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'activity_attachments: segredo service_role_key ausente no Vault; objeto % não removido', OLD.path;
    RETURN OLD;
  END IF;

  PERFORM net.http_delete(
    url := 'https://ynjxvzjomizfyabupvne.supabase.co/storage/v1/object/activity-attachments/' || OLD.path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    )
  );
  RETURN OLD;
END;
$$;

-- O trigger já existe (20261101150000); só a função mudou.
