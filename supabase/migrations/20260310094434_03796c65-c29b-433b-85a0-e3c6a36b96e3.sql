
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'vendedor')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select user_roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert user_roles"
  ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update user_roles"
  ON public.user_roles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete user_roles"
  ON public.user_roles FOR DELETE TO authenticated USING (true);
