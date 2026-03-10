import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Users, Target, CheckCircle2, Handshake, DollarSign, Trophy } from "lucide-react";
import {
  PeriodKey,
  PERIOD_OPTIONS,
  getPeriodRange,
  getLeadDate,
  isInRange,
} from "@/lib/dashboard-utils";
import { ACTIVE_STAGES } from "@/lib/constants";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { LeadSourceChart } from "@/components/dashboard/LeadSourceChart";

interface Lead {
  data_criada: string | null;
  created_at: string;
  mql: boolean | null;
  sql_flag: boolean | null;
  status: string;
  oportunidade: number | null;
  arrecadado: number | null;
  utm_source: string | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPercent(value: number): string {
  if (!isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

interface KpiCardProps {
  title: string;
  value: string;
  change: number | null;
  icon: React.ReactNode;
}

function KpiCard({ title, value, change, icon }: KpiCardProps) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const isNeutral = change === null || change === 0;

  return (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        <div className="mt-1.5 flex items-center gap-1">
          {isPositive && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
          {isNegative && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          {isNeutral && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
          <span
            className={`text-xs font-medium ${
              isPositive
                ? "text-emerald-600"
                : isNegative
                  ? "text-red-500"
                  : "text-muted-foreground"
            }`}
          >
            {change !== null && isFinite(change)
              ? `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs anterior`
              : "sem comparação"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function computeChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

const DashboardPage = () => {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("leads")
        .select("data_criada, created_at, mql, sql_flag, status, oportunidade, arrecadado, utm_source");
      setLeads((data as Lead[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const kpis = useMemo(() => {
    const { current, previous } = getPeriodRange(period);

    const currentLeads = leads.filter((l) => isInRange(getLeadDate(l), current));
    const previousLeads = leads.filter((l) => isInRange(getLeadDate(l), previous));

    // Total Leads
    const totalCurrent = currentLeads.length;
    const totalPrevious = previousLeads.length;

    // MQL rate
    const mqlCurrent = currentLeads.filter((l) => l.mql).length;
    const mqlPrevious = previousLeads.filter((l) => l.mql).length;
    const mqlRateCurrent = totalCurrent > 0 ? (mqlCurrent / totalCurrent) * 100 : 0;
    const mqlRatePrevious = totalPrevious > 0 ? (mqlPrevious / totalPrevious) * 100 : 0;

    // SQL rate (of MQL)
    const sqlCurrent = currentLeads.filter((l) => l.mql && l.sql_flag).length;
    const sqlPrevious = previousLeads.filter((l) => l.mql && l.sql_flag).length;
    const sqlRateCurrent = mqlCurrent > 0 ? (sqlCurrent / mqlCurrent) * 100 : 0;
    const sqlRatePrevious = mqlPrevious > 0 ? (sqlPrevious / mqlPrevious) * 100 : 0;

    // Close rate (of SQL)
    const closedCurrent = currentLeads.filter((l) => l.mql && l.sql_flag && l.status === "contrato_assinado").length;
    const closedPrevious = previousLeads.filter((l) => l.mql && l.sql_flag && l.status === "contrato_assinado").length;
    const closeRateCurrent = sqlCurrent > 0 ? (closedCurrent / sqlCurrent) * 100 : 0;
    const closeRatePrevious = sqlPrevious > 0 ? (closedPrevious / sqlPrevious) * 100 : 0;

    // Pipeline (active stages only — no period filter, just active leads)
    const activeStagesSet = new Set(ACTIVE_STAGES as readonly string[]);
    const pipelineLeads = leads.filter((l) => activeStagesSet.has(l.status));
    const pipelineTotal = pipelineLeads.reduce((sum, l) => sum + (l.oportunidade || 0), 0);

    // Arrecadado (contrato_assinado within period)
    const arrecadadoCurrent = currentLeads
      .filter((l) => l.status === "contrato_assinado")
      .reduce((sum, l) => sum + (l.arrecadado || 0), 0);
    const arrecadadoPrevious = previousLeads
      .filter((l) => l.status === "contrato_assinado")
      .reduce((sum, l) => sum + (l.arrecadado || 0), 0);

    return {
      totalLeads: { value: totalCurrent, change: computeChange(totalCurrent, totalPrevious) },
      mqlRate: { value: mqlRateCurrent, change: computeChange(mqlRateCurrent, mqlRatePrevious) },
      sqlRate: { value: sqlRateCurrent, change: computeChange(sqlRateCurrent, sqlRatePrevious) },
      closeRate: { value: closeRateCurrent, change: computeChange(closeRateCurrent, closeRatePrevious) },
      pipeline: { value: pipelineTotal, change: null },
      arrecadado: { value: arrecadadoCurrent, change: computeChange(arrecadadoCurrent, arrecadadoPrevious) },
    };
  }, [leads, period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">KPIs de vendas e marketing.</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex-1 min-w-[160px] animate-pulse">
              <CardContent className="pt-5 pb-4 px-5 h-[120px]" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            title="Total Leads"
            value={kpis.totalLeads.value.toLocaleString("pt-BR")}
            change={kpis.totalLeads.change}
            icon={<Users className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="Taxa MQL"
            value={formatPercent(kpis.mqlRate.value)}
            change={kpis.mqlRate.change}
            icon={<Target className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="Taxa SQL"
            value={formatPercent(kpis.sqlRate.value)}
            change={kpis.sqlRate.change}
            icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="Fechamento"
            value={formatPercent(kpis.closeRate.value)}
            change={kpis.closeRate.change}
            icon={<Handshake className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="Pipeline"
            value={formatCurrency(kpis.pipeline.value)}
            change={kpis.pipeline.change}
            icon={<DollarSign className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="Arrecadado"
            value={formatCurrency(kpis.arrecadado.value)}
            change={kpis.arrecadado.change}
            icon={<Trophy className="h-4 w-4 text-primary" />}
          />
        </div>
      )}

      {!loading && (
        <FunnelChart
          leads={leads.filter((l) => {
            const { current } = getPeriodRange(period);
            return isInRange(getLeadDate(l), current);
          })}
        />
      )}
    </div>
  );
};

export default DashboardPage;
