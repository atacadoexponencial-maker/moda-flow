-- ============================================================
-- S1-05: Atividades com anexo
--  - bucket privado 'activity-attachments';
--  - tabela activity_attachments (um arquivo por linha), apagada em cascata com
--    a atividade e com o lead;
--  - limites no banco (SUP-S1-04): até 5 arquivos por atividade, 10 MB cada,
--    imagens (jpg, png, webp, gif) e PDF;
--  - ao apagar o registro do anexo, o objeto do Storage é removido (decisão
--    Marcelle 2026-11-01: trigger no banco);
--  - acesso ao bucket só para usuários autenticados (RLS compartilhado, como
--    leads/activities — docs/decisoes/2026-11-01-rls-leads-compartilhado.md).
-- ============================================================

-- 1. Bucket privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-attachments', 'activity-attachments', false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Tabela de anexos
CREATE TABLE IF NOT EXISTS public.activity_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE,
  name text NOT NULL,
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
  size integer NOT NULL CHECK (size > 0 AND size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_attachments_activity ON public.activity_attachments (activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attachments_lead ON public.activity_attachments (lead_id);

ALTER TABLE public.activity_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read activity_attachments" ON public.activity_attachments;
DROP POLICY IF EXISTS "Authenticated users can insert activity_attachments" ON public.activity_attachments;
DROP POLICY IF EXISTS "Authenticated users can delete activity_attachments" ON public.activity_attachments;

CREATE POLICY "Authenticated users can read activity_attachments"
  ON public.activity_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity_attachments"
  ON public.activity_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete activity_attachments"
  ON public.activity_attachments FOR DELETE TO authenticated USING (true);

-- 3. Até 5 anexos por atividade
CREATE OR REPLACE FUNCTION public.fn_activity_attachments_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.activity_attachments WHERE activity_id = NEW.activity_id;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Uma atividade aceita no máximo 5 anexos' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_attachments_limit ON public.activity_attachments;
CREATE TRIGGER trg_activity_attachments_limit
  BEFORE INSERT ON public.activity_attachments
  FOR EACH ROW EXECUTE FUNCTION public.fn_activity_attachments_limit();

-- 4. Apagar o registro remove o objeto do Storage
CREATE OR REPLACE FUNCTION public.fn_activity_attachments_remove_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  DELETE FROM storage.objects WHERE bucket_id = 'activity-attachments' AND name = OLD.path;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_attachments_remove_object ON public.activity_attachments;
CREATE TRIGGER trg_activity_attachments_remove_object
  AFTER DELETE ON public.activity_attachments
  FOR EACH ROW EXECUTE FUNCTION public.fn_activity_attachments_remove_object();

-- 5. Policies do bucket: só autenticados
DROP POLICY IF EXISTS "activity_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "activity_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "activity_attachments_delete" ON storage.objects;

CREATE POLICY "activity_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'activity-attachments');
CREATE POLICY "activity_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'activity-attachments');
CREATE POLICY "activity_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'activity-attachments');
