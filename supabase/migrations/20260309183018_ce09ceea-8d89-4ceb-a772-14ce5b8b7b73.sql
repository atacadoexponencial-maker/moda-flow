-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  instagram TEXT,
  status TEXT NOT NULL DEFAULT 'leads_entrada' CHECK (status IN (
    'leads_entrada', 'qualificacao', 'follow_ra', 'reuniao',
    'proposta_negociacao', 'follow_rr', 'follow_futuro', 'contrato',
    'nutricao', 'desqualificado', 'proposta_recusada', 'contrato_assinado'
  )),
  funil TEXT DEFAULT 'SESSÃO ESTRATÉGICA',
  produto TEXT DEFAULT 'AE',
  mql BOOLEAN DEFAULT false,
  sql_flag BOOLEAN DEFAULT false,
  ra_flag BOOLEAN DEFAULT false,
  rr_flag BOOLEAN DEFAULT false,
  data_ultimo_contato DATE,
  data_proximo_contato DATE,
  data_ra DATE,
  faturamento_mensal TEXT,
  oportunidade NUMERIC DEFAULT 0,
  arrecadado NUMERIC DEFAULT 0,
  loss_reason TEXT,
  justificativa TEXT,
  objetivo TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_content TEXT,
  utm_campaign TEXT,
  utm_posicion TEXT,
  meta_lead_id TEXT,
  meta_ad_id TEXT,
  meta_campaign_id TEXT
);

-- Enable RLS on leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can read leads"
  ON public.leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete leads"
  ON public.leads FOR DELETE TO authenticated USING (true);

-- Create activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('note', 'call', 'meeting', 'status_change')),
  content TEXT,
  created_by TEXT
);

-- Enable RLS on activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can read activities"
  ON public.activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert activities"
  ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update activities"
  ON public.activities FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete activities"
  ON public.activities FOR DELETE TO authenticated USING (true);