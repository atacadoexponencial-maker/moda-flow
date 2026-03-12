CREATE TABLE public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled BOOLEAN DEFAULT true,
  label TEXT DEFAULT 'Webhook Principal',
  last_used_at TIMESTAMPTZ,
  total_leads_received INTEGER DEFAULT 0
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_webhooks"
  ON public.webhook_configs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Insert default webhook config
INSERT INTO public.webhook_configs (label) VALUES ('Webhook Principal');

-- RPC to atomically increment total_leads_received and update last_used_at
CREATE OR REPLACE FUNCTION public.increment_webhook_leads(config_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.webhook_configs
  SET
    total_leads_received = total_leads_received + 1,
    last_used_at = now()
  WHERE id = config_id;
$$;
