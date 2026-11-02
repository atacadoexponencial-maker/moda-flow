-- ============================================================
-- Segurança: o Supabase concede EXECUTE a anon por padrão em funções novas do
-- schema public; REVOKE ... FROM public não remove esse grant explícito.
--  - team_members(): só usuários logados (lista e-mails do time);
--  - increment_webhook_leads(): só a service role (usada pelo webhook-lead).
-- ============================================================

REVOKE ALL ON FUNCTION public.team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_members() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.increment_webhook_leads(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_webhook_leads(uuid) TO service_role;
