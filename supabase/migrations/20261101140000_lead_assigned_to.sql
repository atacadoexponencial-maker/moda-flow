-- ============================================================
-- S1-02: Responsável pelo lead
--  - leads.assigned_to referencia o usuário; remover o usuário zera o campo;
--  - team_members(): lista do time para o seletor (auth.users não é legível
--    pelo cliente);
--  - toda troca de responsável vira uma atividade do tipo 'assignment';
--  - activities.created_by passa a ser preenchido no banco com o e-mail de
--    quem está logado, ou 'Sistema' quando não há usuário (SUP-S1-02).
-- ============================================================

-- 1. Coluna e índice
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to
  ON public.leads (assigned_to) WHERE assigned_to IS NOT NULL;

-- 2. Lista do time para o seletor
CREATE OR REPLACE FUNCTION public.team_members()
RETURNS TABLE (user_id uuid, email text, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.user_id, u.email::text, r.role
  FROM public.user_roles r
  JOIN auth.users u ON u.id = r.user_id
  ORDER BY u.email;
$$;

REVOKE ALL ON FUNCTION public.team_members() FROM public;
GRANT EXECUTE ON FUNCTION public.team_members() TO authenticated;

-- 3. activities.type aceita 'assignment'
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_type_check
  CHECK (type IN ('note', 'call', 'meeting', 'status_change', 'assignment'));

-- 4. created_by preenchido no banco
CREATE OR REPLACE FUNCTION public.fn_activities_created_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS NULL OR btrim(NEW.created_by) = '' THEN
    NEW.created_by := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), 'Sistema');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activities_created_by ON public.activities;
CREATE TRIGGER trg_activities_created_by
  BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.fn_activities_created_by();

-- 5. Troca de responsável vira atividade
CREATE OR REPLACE FUNCTION public.fn_leads_assignment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_new text;
  v_content text;
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  SELECT split_part(u.email, '@', 1) INTO v_old FROM auth.users u WHERE u.id = OLD.assigned_to;
  SELECT split_part(u.email, '@', 1) INTO v_new FROM auth.users u WHERE u.id = NEW.assigned_to;

  IF NEW.assigned_to IS NULL THEN
    v_content := 'Responsável removido' || COALESCE(' (' || v_old || ')', '');
  ELSIF OLD.assigned_to IS NULL THEN
    v_content := 'Responsável definido: ' || COALESCE(v_new, '?');
  ELSE
    v_content := 'Responsável alterado de ' || COALESCE(v_old, '?') || ' para ' || COALESCE(v_new, '?');
  END IF;

  INSERT INTO public.activities (lead_id, type, content)
  VALUES (NEW.id, 'assignment', v_content);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_assignment_activity ON public.leads;
CREATE TRIGGER trg_leads_assignment_activity
  AFTER UPDATE OF assigned_to ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_leads_assignment_activity();

-- 6. Coluna "Responsável" no controle de colunas da tabela de Leads
INSERT INTO public.lead_field_definitions (key, label, field_type, visible, sort_order, is_system)
VALUES ('assigned_to', 'Responsável', 'text', true, 9, true)
ON CONFLICT (key) DO NOTHING;
