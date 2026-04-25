-- Restrict UPDATE on user_roles to admins only
DROP POLICY IF EXISTS "Authenticated users can update user_roles" ON public.user_roles;

CREATE POLICY "Admins can update user_roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
