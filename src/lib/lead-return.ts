// Destaque de lead que voltou (SUP-S1-03: 7 dias). A regra de reabrir, o
// registro na linha do tempo e a marcação ficam no banco (trigger de dedup,
// migration 20261101170000_lead_return.sql); aqui só decidimos o que exibir.

export const RETURN_HIGHLIGHT_DAYS = 7;

export interface ReturnableLead {
  last_return_at: string | null;
}

/** Selo "Voltou": retorno registrado há menos de 7 dias. */
export function hasRecentReturn(lead: ReturnableLead, now: Date = new Date()): boolean {
  if (!lead.last_return_at) return false;
  const t = new Date(lead.last_return_at).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < RETURN_HIGHLIGHT_DAYS * 24 * 60 * 60 * 1000;
}

/** Data de corte (ISO) para buscar quem voltou no período de destaque. */
export function returnCutoffIso(now: Date = new Date()): string {
  return new Date(now.getTime() - RETURN_HIGHLIGHT_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Lista de quem voltou no período, mais recente primeiro. */
export function recentReturns<T extends ReturnableLead>(leads: T[], now: Date = new Date()): T[] {
  return leads
    .filter((l) => hasRecentReturn(l, now))
    .sort((a, b) => (b.last_return_at ?? '').localeCompare(a.last_return_at ?? ''));
}
