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
