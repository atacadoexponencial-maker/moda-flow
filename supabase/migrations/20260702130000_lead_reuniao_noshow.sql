-- ============================================================
-- Campos de reunião realizada e no-show no lead
-- data_rr: quando a reunião de fato aconteceu (rr_flag marca QUE aconteceu)
-- no_show: lead faltou à reunião agendada
-- no_show_motivo: motivo padronizado/texto livre registrado pelo comercial
-- ============================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS data_rr date,
  ADD COLUMN IF NOT EXISTS no_show boolean,
  ADD COLUMN IF NOT EXISTS no_show_motivo text;
