import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Users, Target, CheckCircle2, Handshake, Trophy } from "lucide-react";
import {
  PeriodKey,
  getPeriodRange,
  getLeadDate,
  isInRange,
} from "@/lib/dashboard-utils";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { LeadSourceChart } from "@/components/dashboard/LeadSourceChart";
import { format } from "date-fns";

// TODO: substituir por campo do back-end quando disponível
const META_ARRECADADO = 0;

interface Lead {
  data_criada: string | null;
  created_at: string;
  mql: boolean | null;
  sql_flag: boolean | null;
  ra_flag: boolean | null;
  rr_flag: boolean | null;
  status: string;
  oportunidade: number | null;
  arrecadado: number | null;
  utm_source: string | null;
  funil: string | null;
}

interface FunnelCampaign {
  funil: string;
  campaign_id: string;
}

interface MetaAdsRow {
  campaign_id: string | null;
  spend: number | null;
  date_start: string | null;
  date_stop: string | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface KpiCardProps {
  title: string;
  value: string;
  change: number | null;
  icon: React.ReactNode;
  metaValue?: number;
}

function KpiCard({ title, value, change, icon, metaValue }: KpiCardProps) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const isNeutral = change === null || change === 0;

  const metaPercent = metaValue && metaValue > 0
    ? Math.min(Math.round((parseFloat(value.replace(/\D/g, "")) / metaValue) * 100), 100)
    : null;

  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate pr-2">
            {title}
          </span>
          <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight leading-tight">{value}</p>
        <div className="mt-1.5 flex items-center gap-1">
          {isPositive && <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
          {isNegative && <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          {isNeutral && <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span
            className={`text-xs font-medium truncate ${
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
        {metaValue && metaValue > 0 && metaPercent !== null && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Meta</span>
              <span className={`text-xs font-bold ${metaPercent >= 100 ? "text-emerald-600" : metaPercent >= 70 ? "text-amber-600" : "text-red-500"}`}>
                {metaPercent}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${metaPercent >= 100 ? "bg-emerald-500" : metaPercent >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${metaPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(metaValue)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function computeChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

const PERIOD_BUTTONS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
  { key: "90d", label: "90 dias" },
];

function calcSpendForRange(
  metaRows: MetaAdsRow[],
  funnelCampaigns: FunnelCampaign[],
  rangeFrom: Date,
  rangeTo: Date,
  funil: string,
) {
  const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
  const from = fmtDate(rangeFrom);
  const to = fmtDate(rangeTo);

  let campaignIds: Set<string>;
  if (funil === "all") {
    campaignIds = new Set(funnelCampaigns.map((fc) => fc.campaign_id));
  } else {
    campaignIds = new Set(
      funnelCampaigns.filter((fc) => fc.funil === funil).map((fc) => fc.campaign_id)
    );
  }

  return metaRows
    .filter((r) => {
      if (!r.campaign_id || !r.date_start || !r.date_stop) return false;
      if (!campaignIds.has(r.campaign_id)) return false;
      return r.date_start <= to && r.date_stop >= from;
    })
    .reduce((sum, r) => sum + (r.spend || 0), 0);
}

const DashboardPage = () => {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [selectedFunil, setSelectedFunil] = useState<string>("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [funnelCampaigns, setFunnelCampaigns] = useState<FunnelCampaign[]>([]);
  const [metaAds, setMetaAds] = useState<MetaAdsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [leadsRes, fcRes, metaRes] = await Promise.all([
        supabase
          .from("leads")
          .select("data_criada, created_at, mql, sql_flag, ra_flag, rr_flag, status, oportunidade, arrecadado, utm_source, funil"),
        supabase.from("funnel_campaigns").select("funil, campaign_id"),
        supabase.from("meta_ads_cache").select("campaign_id, spend, date_start, date_stop"),
      ]);
      setLeads((leadsRes.data as Lead[]) || []);
      setFunnelCampaigns((fcRes.data as FunnelCampaign[]) || []);
      setMetaAds((metaRes.data as MetaAdsRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const funilOptions = useMemo(() => {
    const unique = [...new Set(leads.map((l) => l.funil).filter(Boolean))] as string[];
    return unique.sort();
  }, [leads]);

  const currentLeadsForCharts = useMemo(() => {
    const { current } = getPeriodRange(period);
    return leads.filter((l) => isInRange(getLeadDate(l), current));
  }, [leads, period]);

  const investimento = useMemo(() => {
    const { current } = getPeriodRange(period);
    return calcSpendForRange(metaAds, funnelCampaigns, current.from, current.to, selectedFunil);
  }, [metaAds, funnelCampaigns, period, selectedFunil]);

  const kpis = useMemo(() => {
    const { current, previous } = getPeriodRange(period);

    const currentLeads = leads.filter((l) => isInRange(getLeadDate(l), current));
    const previousLeads = leads.filter((l) => isInRange(getLeadDate(l), previous));

    const totalCurrent = currentLeads.length;
    const totalPrevious = previousLeads.length;

    const mqlCurrent = currentLeads.filter((l) => l.mql).length;
    const mqlPrevious = previousLeads.filter((l) => l.mql).length;

    const sqlCurrent = currentLeads.filter((l) => l.sql_flag).length;
    const sqlPrevious = previousLeads.filter((l) => l.sql_flag).length;

    const comprasCurrent = currentLeads.filter((l) => l.status === "contrato_assinado").length;
    const comprasPrevious = previousLeads.filter((l) => l.status === "contrato_assinado").length;

    const arrecadadoCurrent = currentLeads
      .filter((l) => l.status === "contrato_assinado")
      .reduce((sum, l) => sum + (l.arrecadado || 0), 0);
    const arrecadadoPrevious = previousLeads
      .filter((l) => l.status === "contrato_assinado")
      .reduce((sum, l) => sum + (l.arrecadado || 0), 0);

    return {
      arrecadado: { value: arrecadadoCurrent, change: computeChange(arrecadadoCurrent, arrecadadoPrevious) },
      totalLeads: { value: totalCurrent, change: computeChange(totalCurrent, totalPrevious) },
      mqls: { value: mqlCurrent, change: computeChange(mqlCurrent, mqlPrevious) },
      sqls: { value: sqlCurrent, change: computeChange(sqlCurrent, sqlPrevious) },
      compras: { value: comprasCurrent, change: computeChange(comprasCurrent, comprasPrevious) },
    };
  }, [leads, period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">KPIs de vendas e marketing.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {PERIOD_BUTTONS.map((p) => (
              <Button
                key={p.key}
                variant={period === p.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Select value={selectedFunil} onValueChange={setSelectedFunil}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funis</SelectItem>
              {funilOptions.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="flex-1 animate-pulse">
              <CardContent className="pt-4 pb-4 px-4 h-[110px]" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Arrecadado"
            value={formatCurrency(kpis.arrecadado.value)}
            change={kpis.arrecadado.change}
            icon={<Trophy className="h-4 w-4 text-primary" />}
            metaValue={META_ARRECADADO}
          />
          <KpiCard
            title="Total de Leads"
            value={kpis.totalLeads.value.toLocaleString("pt-BR")}
            change={kpis.totalLeads.change}
            icon={<Users className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="MQLs"
            value={kpis.mqls.value.toLocaleString("pt-BR")}
            change={kpis.mqls.change}
            icon={<Target className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="SQLs"
            value={kpis.sqls.value.toLocaleString("pt-BR")}
            change={kpis.sqls.change}
            icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            title="Compras"
            value={kpis.compras.value.toLocaleString("pt-BR")}
            change={kpis.compras.change}
            icon={<Handshake className="h-4 w-4 text-primary" />}
          />
        </div>
      )}

      {!loading && (
        <FunnelChart leads={currentLeadsForCharts} funil={selectedFunil} investimento={investimento} />
      )}

      {!loading && (
        <LeadSourceChart leads={currentLeadsForCharts} />
      )}
    </div>
  );
};

export default DashboardPage;
