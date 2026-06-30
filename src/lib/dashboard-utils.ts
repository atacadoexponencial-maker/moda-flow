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

export interface TouchWithCampaign extends Touch {
  utm_campaign: string | null;
}

export interface MetaCacheRow {
  campaign_name: string | null;
  spend: number | null;
  date_start: string | null;
}

export interface FunnelMetricsRow {
  funil: string;
  novosPagos: number;
  novosOrganicos: number;
  retornos: number;
  investimento: number;
  cpl: number | null;
}

export interface FunnelMetrics {
  porFunil: FunnelMetricsRow[];
  totais: { novosPagos: number; novosOrganicos: number; retornos: number; investimento: number; cpl: number | null };
}

const normCampaign = (s: string | null) => (s || "").trim().toLowerCase();

/**
 * Calcula, por funil e no período, as aquisições pagas vs orgânicas, os
 * retornos, o investimento (spend das campanhas que alimentaram o funil) e
 * o CPL (investimento ÷ aquisições pagas).
 *
 * - Pago: o touch tem utm_campaign que casa com uma campanha do Meta (cache).
 * - Orgânico: sem utm_campaign ou sem correspondência no Meta.
 * - O spend (linhas diárias) é atribuído ao funil onde caíram os leads da
 *   campanha (funil dominante por campanha).
 */
export function computeFunnelMetrics(
  touches: TouchWithCampaign[],
  metaCache: MetaCacheRow[],
  range: PeriodRange,
): FunnelMetrics {
  const paidCampaignNames = new Set(
    metaCache.map((r) => normCampaign(r.campaign_name)).filter((n) => n !== ""),
  );

  const inRange = touches.filter((t) => isInRange(startOfDay(new Date(t.created_at)), range));

  // campanha -> funil dominante (a partir dos touches pagos no período)
  const votes = new Map<string, Map<string, number>>();
  for (const t of inRange) {
    const c = normCampaign(t.utm_campaign);
    if (!c || !paidCampaignNames.has(c)) continue;
    const funil = t.funil || "(sem funil)";
    const v = votes.get(c) ?? new Map<string, number>();
    v.set(funil, (v.get(funil) ?? 0) + 1);
    votes.set(c, v);
  }
  const campaignToFunnel = new Map<string, string>();
  for (const [c, v] of votes) {
    const top = [...v.entries()].sort((a, b) => b[1] - a[1])[0][0];
    campaignToFunnel.set(c, top);
  }

  // spend por funil (linhas diárias do cache dentro do período)
  const spendByFunnel = new Map<string, number>();
  for (const r of metaCache) {
    if (!r.date_start) continue;
    if (!isInRange(startOfDay(new Date(r.date_start)), range)) continue;
    const funil = campaignToFunnel.get(normCampaign(r.campaign_name));
    if (!funil) continue; // campanha sem touches no período: não atribuível
    spendByFunnel.set(funil, (spendByFunnel.get(funil) ?? 0) + (r.spend || 0));
  }

  // contagens por funil
  const counts = new Map<string, { novosPagos: number; novosOrganicos: number; retornos: number }>();
  for (const t of inRange) {
    const funil = t.funil || "(sem funil)";
    const e = counts.get(funil) ?? { novosPagos: 0, novosOrganicos: 0, retornos: 0 };
    const paid = paidCampaignNames.has(normCampaign(t.utm_campaign));
    if (!t.is_aquisicao) e.retornos++;
    else if (paid) e.novosPagos++;
    else e.novosOrganicos++;
    counts.set(funil, e);
  }

  const funnels = new Set<string>([...counts.keys(), ...spendByFunnel.keys()]);
  const porFunil: FunnelMetricsRow[] = [...funnels]
    .map((funil) => {
      const c = counts.get(funil) ?? { novosPagos: 0, novosOrganicos: 0, retornos: 0 };
      const investimento = spendByFunnel.get(funil) ?? 0;
      return {
        funil,
        novosPagos: c.novosPagos,
        novosOrganicos: c.novosOrganicos,
        retornos: c.retornos,
        investimento,
        cpl: c.novosPagos > 0 ? investimento / c.novosPagos : null,
      };
    })
    .sort(
      (a, b) =>
        b.novosPagos + b.novosOrganicos + b.retornos - (a.novosPagos + a.novosOrganicos + a.retornos) ||
        a.funil.localeCompare(b.funil),
    );

  const totais = porFunil.reduce(
    (acc, r) => ({
      novosPagos: acc.novosPagos + r.novosPagos,
      novosOrganicos: acc.novosOrganicos + r.novosOrganicos,
      retornos: acc.retornos + r.retornos,
      investimento: acc.investimento + r.investimento,
      cpl: null as number | null,
    }),
    { novosPagos: 0, novosOrganicos: 0, retornos: 0, investimento: 0, cpl: null as number | null },
  );
  totais.cpl = totais.novosPagos > 0 ? totais.investimento / totais.novosPagos : null;

  return { porFunil, totais };
}
