// Motivo de perda padronizado: a mesma lista usada no ClickUp, para os números
// continuarem comparáveis. "Outro" permite texto livre; o que fica gravado em
// leads.loss_reason é sempre texto (o motivo da lista ou o texto digitado).

export const OTHER_LOSS_REASON = 'Outro';

export const LOSS_REASONS = [
  'Nunca respondeu abordagem',
  'Fora do perfil',
  'Não tem interesse',
  'Não é prioridade',
  'No show',
  'Não tem budget',
  'Tentativas de contato esgotadas',
  'Não tem time',
  OTHER_LOSS_REASON,
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export function isStandardLossReason(value: string | null | undefined): boolean {
  return !!value && value !== OTHER_LOSS_REASON && (LOSS_REASONS as readonly string[]).includes(value);
}

/**
 * Valor a gravar a partir da escolha na tela. null = inválido (confirmação bloqueada):
 * sem motivo, motivo fora da lista, ou "Outro" sem texto.
 */
export function resolveLossReason(selected: string | null | undefined, otherText: string | null | undefined): string | null {
  if (!selected) return null;
  if (selected === OTHER_LOSS_REASON) {
    const t = (otherText ?? '').trim();
    return t.length > 0 ? t : null;
  }
  return isStandardLossReason(selected) ? selected : null;
}

/** Item do seletor para um motivo já gravado: o próprio, "Outro" para texto livre, '' se vazio. */
export function lossReasonSelectValue(stored: string | null | undefined): string {
  if (!stored) return '';
  return isStandardLossReason(stored) ? stored : OTHER_LOSS_REASON;
}

/** Texto a mostrar na caixa "Outro" para um motivo já gravado (vazio se for item da lista). */
export function lossReasonOtherText(stored: string | null | undefined): string {
  if (!stored || isStandardLossReason(stored) || stored === OTHER_LOSS_REASON) return '';
  return stored;
}
