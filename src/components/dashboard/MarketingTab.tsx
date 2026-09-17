import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import {
  PeriodKey,
  getPeriodRange,
  getLeadDate,
  isInRange,
  resolveCampaignFunnel,
  normalizeCampaignName,
  type TouchWithCampaign,
  type FunnelMetrics,
  type FunnelCampaignLink,
} from "@/lib/dashboard-utils";
import { LeadSourceChart } from "@/components/dashboard/LeadSourceChart";

export interface MarketingLead {
  data_criada: string | null;
  created_at: string;
  mql: boolean | null;
  sql_flag: boolean | null;
  status: string;
  arrecadado: number | null;
  utm_source: string | null;
  funil: string | null;
}

interface MarketingTabProps {
  leads: MarketingLead[];
  touches: TouchWithCampaign[];
  funnelMetrics: FunnelMetrics;
  funnelCampaigns: FunnelCampaignLink[];
  period: PeriodKey;
  selectedFunil: string;
}

interface AdInsightRow {
  date_start: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  spend: number | null;
  fetched_at: string;
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCpl(v: number | null): string {
  if (v === null || !isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRoas(v: number | null): string {
  if (v === null || !isFinite(v)) return "—";
  return `${v.toFixed(2)}x`;
}

interface RankingRow {
  id: string;
  name: string;
  spend: number;
  leads: number;
  cpl: number | null;
}

type SortKey = "spend" | "leads" | "cpl";

function RankingTable({ title, subtitle, rows }: { title: string; subtitle?: string; rows: RankingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sortKey === "cpl") {
      // CPL: menor é melhor; sem CPL vai para o fim
      arr.sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity));
    } else {
      arr.sort((a, b) => b[sortKey] - a[sortKey]);
    }
    return arr;
  }, [rows, sortKey]);

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => setSortKey(k)}
      className={`inline-flex items-center gap-1 ${sortKey === k ? "text-foreground font-semibold" : ""}`}
      title={`Ordenar por ${label}`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <Card>
      <CardContent className="pt-4 pb-4 px-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum dado no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">Nome</th>
                  <th className="py-2 px-3 font-medium text-right"><SortButton k="spend" label="Investimento" /></th>
                  <th className="py-2 px-3 font-medium text-right"><SortButton k="leads" label="Leads" /></th>
                  <th className="py-2 pl-3 font-medium text-right"><SortButton k="cpl" label="CPL" /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 15).map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-foreground max-w-[340px] truncate" title={r.name}>{r.name}</td>
                    <td className="py-2 px-3 text-right text-foreground">{fmtCurrency(r.spend)}</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-600">{r.leads}</td>
                    <td className="py-2 pl-3 text-right text-foreground">{fmtCpl(r.cpl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketingTab({ leads, touches, funnelMetrics, funnelCampaigns, period, selectedFunil }: MarketingTabProps) {
  const { current } = useMemo(() => getPeriodRange(period), [period]);

  const { data: adInsights = [] } = useQuery({
    queryKey: ["meta-ads-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ads_insights")
        .select("date_start, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, fetched_at");
      if (error) throw error;
      return (data as AdInsightRow[]) || [];
    },
  });

  const lastSync = useMemo(() => {
    if (adInsights.length === 0) return null;
    return adInsights.reduce((max, r) => (r.fetched_at > max ? r.fetched_at : max), adInsights[0].fetched_at);
  }, [adInsights]);

  const manualFunnelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const fc of funnelCampaigns) if (fc.campaign_id) m.set(fc.campaign_id, fc.funil);
    return m;
  }, [funnelCampaigns]);

  // Arrecadado por funil (contratos assinados no período) para o ROAS
  const arrecadadoPorFunil = useMemo(() => {
    const m = new Map<string, number>();
    let total = 0;
    for (const l of leads) {
      if (l.status !== "contrato_assinado") continue;
      if (!isInRange(getLeadDate(l), current)) continue;
      const funil = l.funil || "(sem funil)";
      const v = l.arrecadado || 0;
      m.set(funil, (m.get(funil) ?? 0) + v);
      total += v;
    }
    return { porFunil: m, total };
  }, [leads, current]);

  const rankings = useMemo(() => {
    const inRange = adInsights.filter(
      (r) => r.date_start && isInRange(startOfDay(new Date(r.date_start)), current),
    );

    // Filtro por funil: campanha pertence ao funil (vínculo manual ou token do nome)
    const filtered =
      selectedFunil === "all"
        ? inRange
        : inRange.filter(
            (r) => resolveCampaignFunnel(r.campaign_id, r.campaign_name, manualFunnelById) === selectedFunil,
          );

    const touchesInRange = touches.filter((t) => isInRange(startOfDay(new Date(t.created_at)), current));

    // Spend agregado
    const campaigns = new Map<string, RankingRow>();
    const adsets = new Map<string, RankingRow>();
    const ads = new Map<string, RankingRow>();
    const adToAdset = new Map<string, string>();
    const campaignNamesById = new Map<string, string>();

    for (const r of filtered) {
      const spend = r.spend || 0;
      if (r.campaign_id) {
        const e = campaigns.get(r.campaign_id) ?? { id: r.campaign_id, name: r.campaign_name || r.campaign_id, spend: 0, leads: 0, cpl: null };
        e.spend += spend;
        campaigns.set(r.campaign_id, e);
        campaignNamesById.set(r.campaign_id, r.campaign_name || "");
      }
      if (r.adset_id) {
        const e = adsets.get(r.adset_id) ?? { id: r.adset_id, name: r.adset_name || r.adset_id, spend: 0, leads: 0, cpl: null };
        e.spend += spend;
        adsets.set(r.adset_id, e);
      }
      if (r.ad_id) {
        const e = ads.get(r.ad_id) ?? { id: r.ad_id, name: r.ad_name || r.ad_id, spend: 0, leads: 0, cpl: null };
        e.spend += spend;
        ads.set(r.ad_id, e);
        if (r.adset_id) adToAdset.set(r.ad_id, r.adset_id);
      }
    }

    // Atribuição de leads: campanha por meta_campaign_id ou nome da utm_campaign;
    // anúncio por meta_ad_id; conjunto herda do anúncio.
    const campaignIdByNormName = new Map<string, string>();
    for (const [id, name] of campaignNamesById) {
      const norm = normalizeCampaignName(name);
      if (norm) campaignIdByNormName.set(norm, id);
    }

    for (const t of touchesInRange) {
      const campaignId =
        (t.meta_campaign_id && campaigns.has(t.meta_campaign_id) ? t.meta_campaign_id : undefined) ??
        campaignIdByNormName.get(normalizeCampaignName(t.utm_campaign));
      if (campaignId) {
        const e = campaigns.get(campaignId);
        if (e) e.leads++;
      }
      if (t.meta_ad_id && ads.has(t.meta_ad_id)) {
        const ad = ads.get(t.meta_ad_id)!;
        ad.leads++;
        const adsetId = adToAdset.get(t.meta_ad_id);
        if (adsetId) {
          const as = adsets.get(adsetId);
          if (as) as.leads++;
        }
      }
    }

    const finish = (m: Map<string, RankingRow>): RankingRow[] =>
      [...m.values()].map((r) => ({ ...r, cpl: r.spend > 0 && r.leads > 0 ? r.spend / r.leads : null }));

    return { campaigns: finish(campaigns), adsets: finish(adsets), ads: finish(ads) };
  }, [adInsights, touches, current, selectedFunil, manualFunnelById]);

  const leadsInRange = useMemo(() => leads.filter((l) => isInRange(getLeadDate(l), current)), [leads, current]);

  return (
    <div className="space-y-6">
      {/* Resultados por funil (investimento, CPL, arrecadado, ROAS) */}
      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <div className="mb-3 flex items-start justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Resultados por funil</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Investimento atribuído pelo funil da campanha; leads contados pelo funil do formulário. CPL = investimento ÷ novos pagos. ROAS = arrecadado ÷ investimento.
              </p>
            </div>
            {lastSync && (
              <span className="text-xs text-muted-foreground">
                Última sync Meta: {format(new Date(lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          {funnelMetrics.porFunil.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum touch no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-4 font-medium">Funil</th>
                    <th className="py-2 px-3 font-medium text-right">Investimento</th>
                    <th className="py-2 px-3 font-medium text-right">Novos pagos</th>
                    <th className="py-2 px-3 font-medium text-right">Orgânicos</th>
                    <th className="py-2 px-3 font-medium text-right">Retornos</th>
                    <th className="py-2 px-3 font-medium text-right">CPL</th>
                    <th className="py-2 px-3 font-medium text-right">Arrecadado</th>
                    <th className="py-2 pl-3 font-medium text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelMetrics.porFunil.map((f) => {
                    const arrecadado = arrecadadoPorFunil.porFunil.get(f.funil) ?? 0;
                    const roas = f.investimento > 0 ? arrecadado / f.investimento : null;
                    return (
                      <tr key={f.funil} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-foreground">{f.funil}</td>
                        <td className="py-2 px-3 text-right text-foreground">{fmtCurrency(f.investimento)}</td>
                        <td className="py-2 px-3 text-right font-medium text-emerald-600">{f.novosPagos}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{f.novosOrganicos}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{f.retornos}</td>
                        <td className="py-2 px-3 text-right text-foreground">{fmtCpl(f.cpl)}</td>
                        <td className="py-2 px-3 text-right text-foreground">{fmtCurrency(arrecadado)}</td>
                        <td className="py-2 pl-3 text-right font-semibold text-foreground">{fmtRoas(roas)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 pr-4 text-foreground">Total</td>
                    <td className="py-2 px-3 text-right text-foreground">{fmtCurrency(funnelMetrics.totais.investimento)}</td>
                    <td className="py-2 px-3 text-right text-emerald-600">{funnelMetrics.totais.novosPagos}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{funnelMetrics.totais.novosOrganicos}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{funnelMetrics.totais.retornos}</td>
                    <td className="py-2 px-3 text-right text-foreground">{fmtCpl(funnelMetrics.totais.cpl)}</td>
                    <td className="py-2 px-3 text-right text-foreground">{fmtCurrency(arrecadadoPorFunil.total)}</td>
                    <td className="py-2 pl-3 text-right text-foreground">
                      {fmtRoas(funnelMetrics.totais.investimento > 0 ? arrecadadoPorFunil.total / funnelMetrics.totais.investimento : null)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rankings */}
      <RankingTable
        title="Melhores campanhas"
        subtitle="Leads atribuídos por campanha (id do Meta ou utm_campaign). Clique nas colunas para ordenar."
        rows={rankings.campaigns}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankingTable title="Melhores conjuntos" rows={rankings.adsets} />
        <RankingTable title="Melhores criativos" rows={rankings.ads} />
      </div>

      <LeadSourceChart leads={leadsInRange} />
    </div>
  );
}
