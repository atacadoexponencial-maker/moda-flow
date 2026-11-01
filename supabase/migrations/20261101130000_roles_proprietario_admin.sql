-- ============================================================
-- S1-01: Papéis proprietário e admin
-- Reduz os papéis a 'proprietario' (uma única conta, intocável) e 'admin'.
--  - 'vendedor' deixa de existir (linhas remanescentes viram 'admin');
--  - a linha 'admin' mais antiga vira 'proprietario' quando ainda não há um;
--  - no máximo um proprietário (índice único parcial);
--  - a linha do proprietário não pode ser alterada nem apagada (trigger);
--  - todo usuário novo em auth.users recebe 'admin' automaticamente (trigger);
--  - policies de user_roles aceitam os dois papéis.
-- ============================================================

-- 1. Converter papéis legados antes de apertar o CHECK
UPDATE public.user_roles SET role = 'admin' WHERE role = 'vendedor';

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('proprietario', 'admin'));

-- 2. A conta atual (admin mais antigo) vira proprietária, se ainda não houver uma
UPDATE public.user_roles
SET role = 'proprietario'
WHERE id = (
  SELECT id FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'proprietario');

-- 3. No máximo um proprietário
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_proprietario
  ON public.user_roles (role) WHERE role = 'proprietario';

-- 4. Proprietário não pode ser alterado nem removido (vale até para service role)
CREATE OR REPLACE FUNCTION public.fn_user_roles_protect_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.role = 'proprietario' THEN
    RAISE EXCEPTION 'O proprietário não pode ser alterado nem removido'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_protect_owner ON public.user_roles;
CREATE TRIGGER trg_user_roles_protect_owner
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_user_roles_protect_owner();

-- 5. Todo usuário novo entra como admin
CREATE OR REPLACE FUNCTION public.fn_auth_users_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_default_role ON auth.users;
CREATE TRIGGER trg_auth_users_default_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_auth_users_default_role();

-- 6. Policies de user_roles: proprietário e admin gerenciam
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;

CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('proprietario', 'admin')
    )
  );

CREATE POLICY "Admins can update user_roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('proprietario', 'admin')
    )
  );

CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('proprietario', 'admin')
    )
  );
