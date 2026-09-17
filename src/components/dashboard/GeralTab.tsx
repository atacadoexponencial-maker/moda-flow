import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Users, RotateCcw, Target, CalendarCheck, CheckCircle2 } from "lucide-react";
import {
  PeriodKey,
  PeriodRange,
  getPeriodRange,
  getLeadDate,
  isInRange,
  type TouchWithCampaign,
  type FunnelMetrics,
} from "@/lib/dashboard-utils";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { startOfDay } from "date-fns";

export interface GeralLead {
  data_criada: string | null;
  created_at: string;
  mql: boolean | null;
  sql_flag: boolean | null;
  ra_flag: boolean | null;
  rr_flag: boolean | null;
  data_ra: string | null;
  data_rr: string | null;
  status: string;
  funil: string | null;
}

interface GeralTabProps {
  leads: GeralLead[];
  touches: TouchWithCampaign[];
  funnelMetrics: FunnelMetrics;
  funnelMetricsPrev: FunnelMetrics;
  period: PeriodKey;
  selectedFunil: string;
}

function formatCost(value: number | null): string {
  if (value === null || !isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

function ChangeIndicator({ change, invert }: { change: number | null; invert?: boolean }) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const isNeutral = change === null || change === 0;
  // Para custos, subir é ruim (invert): verde quando cai, vermelho quando sobe
  const goodColor = "text-emerald-600";
  const badColor = "text-red-500";
  const upColor = invert ? badColor : goodColor;
  const downColor = invert ? goodColor : badColor;
  return (
    <div className="mt-1.5 flex items-center gap-1">
      {isPositive && <TrendingUp className={`h-3.5 w-3.5 ${upColor} shrink-0`} />}
      {isNegative && <TrendingDown className={`h-3.5 w-3.5 ${downColor} shrink-0`} />}
      {isNeutral && <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <span
        className={`text-xs font-medium truncate ${
          isPositive ? upColor : isNegative ? downColor : "text-muted-foreground"
        }`}
      >
        {change !== null && isFinite(change)
          ? `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs anterior`
          : "sem comparação"}
      </span>
    </div>
  );
}

function VolumeCard({ title, value, change, icon }: { title: string; value: number; change: number | null; icon: React.ReactNode }) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate pr-2">{title}</span>
          <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight leading-tight">{value.toLocaleString("pt-BR")}</p>
        <ChangeIndicator change={change} />
      </CardContent>
    </Card>
  );
}

function CostCard({ title, value, change }: { title: string; value: number | null; change: number | null }) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="pt-4 pb-4 px-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate block">{title}</span>
        <p className="text-xl font-bold text-foreground tracking-tight leading-tight mt-1">{formatCost(value)}</p>
        <ChangeIndicator change={change} invert />
      </CardContent>
    </Card>
  );
}

interface PeriodCounts {
  novos: number;
  voltaram: number;
  mql: number;
  ra: number;
  rr: number;
}

/** Data efetiva da RA/RR: campo próprio quando existe; senão, flag + data do lead. */
function flagInRange(
  flag: boolean | null,
  dateStr: string | null,
  lead: GeralLead,
  range: PeriodRange,
): boolean {
  if (dateStr) return isInRange(startOfDay(new Date(dateStr)), range);
  return !!flag && isInRange(getLeadDate(lead), range);
}

function countPeriod(
  leads: GeralLead[],
  touches: TouchWithCampaign[],
  range: PeriodRange,
  selectedFunil: string,
): PeriodCounts {
  const funilMatch = (funil: string | null) => selectedFunil === "all" || funil === selectedFunil;

  let novos = 0;
  let voltaram = 0;
  for (const t of touches) {
    if (!funilMatch(t.funil)) continue;
    if (!isInRange(startOfDay(new Date(t.created_at)), range)) continue;
    if (t.is_aquisicao) novos++;
    else voltaram++;
  }

  let mql = 0;
  let ra = 0;
  let rr = 0;
  for (const l of leads) {
    if (!funilMatch(l.funil)) continue;
    if (l.mql && isInRange(getLeadDate(l), range)) mql++;
    if (flagInRange(l.ra_flag, l.data_ra, l, range)) ra++;
    if (flagInRange(l.rr_flag, l.data_rr, l, range)) rr++;
  }

  return { novos, voltaram, mql, ra, rr };
}

export function GeralTab({ leads, touches, funnelMetrics, funnelMetricsPrev, period, selectedFunil }: GeralTabProps) {
  const { current, previous } = useMemo(() => getPeriodRange(period), [period]);

  const cur = useMemo(() => countPeriod(leads, touches, current, selectedFunil), [leads, touches, current, selectedFunil]);
  const prev = useMemo(() => countPeriod(leads, touches, previous, selectedFunil), [leads, touches, previous, selectedFunil]);

  const investimento = useMemo(() => {
    if (selectedFunil === "all") return funnelMetrics.totais.investimento;
    return funnelMetrics.porFunil.find((f) => f.funil === selectedFunil)?.investimento ?? 0;
  }, [funnelMetrics, selectedFunil]);

  const investimentoPrev = useMemo(() => {
    if (selectedFunil === "all") return funnelMetricsPrev.totais.investimento;
    return funnelMetricsPrev.porFunil.find((f) => f.funil === selectedFunil)?.investimento ?? 0;
  }, [funnelMetricsPrev, selectedFunil]);

  const cost = (invest: number, count: number): number | null =>
    invest > 0 && count > 0 ? invest / count : null;

  const costs = {
    cpl: { cur: cost(investimento, cur.novos), prev: cost(investimentoPrev, prev.novos) },
    mql: { cur: cost(investimento, cur.mql), prev: cost(investimentoPrev, prev.mql) },
    ra: { cur: cost(investimento, cur.ra), prev: cost(investimentoPrev, prev.ra) },
    rr: { cur: cost(investimento, cur.rr), prev: cost(investimentoPrev, prev.rr) },
  };

  const costChange = (c: { cur: number | null; prev: number | null }): number | null =>
    c.cur !== null && c.prev !== null ? computeChange(c.cur, c.prev) : null;

  const leadsForChart = useMemo(
    () => leads.filter((l) => isInRange(getLeadDate(l), current)),
    [leads, current],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <VolumeCard title="Leads novos" value={cur.novos} change={computeChange(cur.novos, prev.novos)} icon={<Users className="h-4 w-4 text-primary" />} />
        <VolumeCard title="Leads que voltaram" value={cur.voltaram} change={computeChange(cur.voltaram, prev.voltaram)} icon={<RotateCcw className="h-4 w-4 text-primary" />} />
        <VolumeCard title="MQLs" value={cur.mql} change={computeChange(cur.mql, prev.mql)} icon={<Target className="h-4 w-4 text-primary" />} />
        <VolumeCard title="Reuniões agendadas" value={cur.ra} change={computeChange(cur.ra, prev.ra)} icon={<CalendarCheck className="h-4 w-4 text-primary" />} />
        <VolumeCard title="Reuniões realizadas" value={cur.rr} change={computeChange(cur.rr, prev.rr)} icon={<CheckCircle2 className="h-4 w-4 text-primary" />} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Custo por etapa</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Investimento do período ({investimento.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 })}) ÷ contagem de cada etapa.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CostCard title="CPL (custo por lead)" value={costs.cpl.cur} change={costChange(costs.cpl)} />
          <CostCard title="Custo por MQL" value={costs.mql.cur} change={costChange(costs.mql)} />
          <CostCard title="Custo por RA" value={costs.ra.cur} change={costChange(costs.ra)} />
          <CostCard title="Custo por RR" value={costs.rr.cur} change={costChange(costs.rr)} />
        </div>
      </div>

      <FunnelChart leads={leadsForChart} funil={selectedFunil} investimento={investimento} />
    </div>
  );
}
