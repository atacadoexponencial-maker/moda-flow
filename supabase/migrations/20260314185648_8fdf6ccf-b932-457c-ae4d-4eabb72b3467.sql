
-- 1. Create lead_field_definitions table
CREATE TABLE public.lead_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','date','boolean','select')),
  options text[],
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.lead_field_definitions ENABLE ROW LEVEL SECURITY;

-- SELECT for all authenticated users
CREATE POLICY "Authenticated users can select lead_field_definitions"
  ON public.lead_field_definitions FOR SELECT TO authenticated
  USING (true);

-- INSERT only for admin/proprietario
CREATE POLICY "Admins can insert lead_field_definitions"
  ON public.lead_field_definitions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'proprietario')
    )
  );

-- UPDATE only for admin/proprietario
CREATE POLICY "Admins can update lead_field_definitions"
  ON public.lead_field_definitions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'proprietario')
    )
  );

-- DELETE only for admin/proprietario
CREATE POLICY "Admins can delete lead_field_definitions"
  ON public.lead_field_definitions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'proprietario')
    )
  );

-- 3. Add custom_data column to leads
ALTER TABLE public.leads ADD COLUMN custom_data jsonb DEFAULT '{}';

-- 4. Seed system field definitions
INSERT INTO public.lead_field_definitions (key, label, field_type, visible, sort_order, is_system) VALUES
  ('nome', 'Nome', 'text', true, 0, true),
  ('entrada', 'Entrada', 'date', true, 1, true),
  ('status', 'Status', 'select', true, 2, true),
  ('faturamento_mensal', 'Faturamento', 'select', true, 3, true),
  ('oportunidade', 'Oportunidade', 'number', true, 4, true),
  ('data_proximo_contato', 'Próx. Contato', 'date', true, 5, true),
  ('mql', 'MQL', 'boolean', true, 6, true),
  ('sql_flag', 'SQL', 'boolean', true, 7, true),
  ('utm_source', 'Fonte', 'text', true, 8, true);
