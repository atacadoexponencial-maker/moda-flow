
CREATE TABLE public.funnel_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  funil text NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  UNIQUE(funil, campaign_id)
);

ALTER TABLE public.funnel_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select funnel_campaigns"
  ON public.funnel_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert funnel_campaigns"
  ON public.funnel_campaigns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete funnel_campaigns"
  ON public.funnel_campaigns FOR DELETE TO authenticated USING (true);
