-- ============================================================
-- S1-07: Visões salvas de filtros (Pipeline e Leads)
-- Cada usuário guarda as próprias combinações de filtros com um nome. As
-- visões são pessoais: RLS por user_id. As visões prontas ("Leads Hoje",
-- "Meus leads", uma por funil) não ficam no banco — são calculadas na tela.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page text NOT NULL CHECK (page IN ('pipeline', 'leads')),
  name text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 60),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user_page ON public.saved_views (user_id, page);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved_views" ON public.saved_views;
CREATE POLICY "Users manage own saved_views"
  ON public.saved_views FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_saved_views_updated_at ON public.saved_views;
CREATE TRIGGER trg_saved_views_updated_at
  BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
