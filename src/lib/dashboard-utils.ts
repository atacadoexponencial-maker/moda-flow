import { useMemo } from "react";
import { startOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

export type PeriodKey = "7d" | "30d" | "90d" | "month";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Mês atual" },
];

export interface PeriodRange {
  from: Date;
  to: Date;
}

export function getPeriodRange(key: PeriodKey): { current: PeriodRange; previous: PeriodRange } {
  const now = new Date();
  const today = startOfDay(now);

  if (key === "month") {
    const currentFrom = startOfMonth(now);
    const currentTo = now;
    const prevMonth = subMonths(now, 1);
    const previousFrom = startOfMonth(prevMonth);
    const previousTo = endOfMonth(prevMonth);
    return {
      current: { from: currentFrom, to: currentTo },
      previous: { from: previousFrom, to: previousTo },
    };
  }

  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  const currentFrom = subDays(today, days - 1);
  const currentTo = now;
  const previousFrom = subDays(currentFrom, days);
  const previousTo = subDays(currentFrom, 1);

  return {
    current: { from: currentFrom, to: currentTo },
    previous: { from: previousFrom, to: previousTo },
  };
}

/** Get the effective date for a lead using COALESCE(data_criada, created_at) */
export function getLeadDate(lead: { data_criada?: string | null; created_at: string }): Date {
  const dateStr = lead.data_criada || lead.created_at;
  return startOfDay(new Date(dateStr));
}

export function isInRange(date: Date, range: PeriodRange): boolean {
  return date >= startOfDay(range.from) && date <= range.to;
}

export interface Touch {
  funil: string | null;
  is_aquisicao: boolean;
  created_at: string;
}

export interface FunnelTouchStats {
  funil: string;
  novos: number;
  retornos: number;
  total: number;
}

export interface TouchAggregation {
  porFunil: FunnelTouchStats[];
  totais: { novos: number; retornos: number; total: number };
}

/**
 * Agrega touches por funil dentro do período, separando aquisições (leads
 * novos no CRM) de retornos (touches de contatos já existentes).
 */
export function aggregateTouchesByFunnel(touches: Touch[], range: PeriodRange): TouchAggregation {
  const map = new Map<string, { novos: number; retornos: number }>();
  let totNovos = 0;
  let totRetornos = 0;

  for (const t of touches) {
    if (!isInRange(startOfDay(new Date(t.created_at)), range)) continue;
    const funil = t.funil || "(sem funil)";
    const entry = map.get(funil) ?? { novos: 0, retornos: 0 };
    if (t.is_aquisicao) {
      entry.novos++;
      totNovos++;
    } else {
      entry.retornos++;
      totRetornos++;
    }
    map.set(funil, entry);
  }

  const porFunil: FunnelTouchStats[] = Array.from(map, ([funil, v]) => ({
    funil,
    novos: v.novos,
    retornos: v.retornos,
    total: v.novos + v.retornos,
  })).sort((a, b) => b.total - a.total || a.funil.localeCompare(b.funil));

  return {
    porFunil,
    totais: { novos: totNovos, retornos: totRetornos, total: totNovos + totRetornos },
  };
}
