
-- Create webhook_configs table
CREATE TABLE public.webhook_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled BOOLEAN NOT NULL DEFAULT true,
  label TEXT DEFAULT 'default',
  last_used_at TIMESTAMPTZ,
  total_leads_received INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can select webhook_configs"
  ON public.webhook_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update webhook_configs"
  ON public.webhook_configs FOR UPDATE TO authenticated USING (true);

-- Function to increment leads counter
CREATE OR REPLACE FUNCTION public.increment_webhook_leads(config_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.webhook_configs
  SET total_leads_received = total_leads_received + 1,
      last_used_at = now()
  WHERE id = config_id;
END;
$$;

-- Insert initial config row
INSERT INTO public.webhook_configs (label) VALUES ('default');
