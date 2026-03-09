export const FUNNEL_STAGES = [
  { value: 'leads_entrada', label: 'Leads de Entrada' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'follow_ra', label: 'Follow-up RA' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'proposta_negociacao', label: 'Proposta / Negociação' },
  { value: 'follow_rr', label: 'Follow-up RR' },
  { value: 'follow_futuro', label: 'Follow-up Futuro' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'desqualificado', label: 'Desqualificado' },
  { value: 'proposta_recusada', label: 'Proposta Recusada' },
  { value: 'contrato_assinado', label: 'Contrato Assinado' },
] as const;

export const ACTIVE_STAGES = [
  'leads_entrada', 'qualificacao', 'follow_ra', 'reuniao',
  'proposta_negociacao', 'follow_rr', 'follow_futuro', 'contrato', 'nutricao',
] as const;

export const WON_STAGES = ['contrato_assinado'] as const;
export const LOST_STAGES = ['desqualificado', 'proposta_recusada'] as const;

export function getStageLabel(value: string): string {
  return FUNNEL_STAGES.find(s => s.value === value)?.label ?? value;
}
