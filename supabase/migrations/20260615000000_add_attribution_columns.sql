-- Migration: add conversion attribution columns to leads
-- Captures fbc, gclid, external_id and utm_term sent by lead sources
-- (webhook / CSV). external_id is indexed for future deduplication.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_external_id
  ON public.leads (external_id)
  WHERE external_id IS NOT NULL;
