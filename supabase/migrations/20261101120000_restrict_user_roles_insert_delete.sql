-- Fecha a escalação de privilégio em user_roles: INSERT e DELETE ainda eram
-- liberados para qualquer usuário autenticado (um usuário sem role podia
-- inserir a si mesmo como admin). UPDATE já era restrito a admins
-- (20260424000001_restrict_user_roles_update.sql); INSERT e DELETE seguem
-- o mesmo padrão. SELECT continua aberto: a UI precisa ler as roles.
--
-- Bootstrap: precisa existir ao menos um admin (hoje existe). Novos admins
-- são criados por um admin pela tela de Usuários.

DROP POLICY IF EXISTS "Authenticated users can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can delete user_roles" ON public.user_roles;

CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
