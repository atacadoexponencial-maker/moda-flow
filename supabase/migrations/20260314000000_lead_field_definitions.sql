-- Tabela de definição de campos do CRM
CREATE TABLE lead_field_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  label       text NOT NULL,
  field_type  text NOT NULL DEFAULT 'text'
                CHECK (field_type IN ('text','number','date','boolean','select')),
  options     text[],
  visible     boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE lead_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lead_field_definitions"
  ON lead_field_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage lead_field_definitions"
  ON lead_field_definitions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'proprietario'))
  );

-- Coluna para valores de campos customizados nos leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}';

-- Seed: 9 campos do sistema
INSERT INTO lead_field_definitions (key, label, field_type, visible, sort_order, is_system) VALUES
  ('nome',                 'Nome',          'text',    true,  0,  true),
  ('entrada',              'Entrada',       'date',    true,  1,  true),
  ('status',               'Status',        'select',  true,  2,  true),
  ('faturamento_mensal',   'Faturamento',   'select',  true,  3,  true),
  ('oportunidade',         'Oportunidade',  'number',  true,  4,  true),
  ('data_proximo_contato', 'Próx. Contato', 'date',    true,  5,  true),
  ('mql',                  'MQL',           'boolean', true,  6,  true),
  ('sql_flag',             'SQL',           'boolean', true,  7,  true),
  ('utm_source',           'Fonte',         'text',    true,  8,  true)
ON CONFLICT (key) DO NOTHING;
