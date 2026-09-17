import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PeriodKey,
  getPeriodRange,
  computeFunnelMetrics,
  type TouchWithCampaign,
  type MetaCacheRow,
  type FunnelCampaignLink,
} from "@/lib/dashboard-utils";
import { GeralTab, type GeralLead } from "@/components/dashboard/GeralTab";
import { MarketingTab } from "@/components/dashboard/MarketingTab";
import { VendasTab } from "@/components/dashboard/VendasTab";

interface Lead extends GeralLead {
  oportunidade: number | null;
  arrecadado: number | null;
  utm_source: string | null;
}

const PERIOD_BUTTONS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
  { key: "90d", label: "90 dias" },
];

const DashboardPage = () => {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [selectedFunil, setSelectedFunil] = useState<string>("all");
  const [tab, setTab] = useState<string>("geral");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metaAds, setMetaAds] = useState<MetaCacheRow[]>([]);
  const [touches, setTouches] = useState<TouchWithCampaign[]>([]);
  const [funnelCampaigns, setFunnelCampaigns] = useState<FunnelCampaignLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [leadsRes, metaRes, touchesRes, fcRes] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "data_criada, created_at, mql, sql_flag, ra_flag, rr_flag, data_ra, data_rr, status, oportunidade, arrecadado, utm_source, funil",
          ),
        supabase.from("meta_ads_cache").select("campaign_id, campaign_name, spend, date_start"),
        supabase
          .from("lead_touches")
          .select("funil, is_aquisicao, created_at, utm_campaign, meta_campaign_id, meta_ad_id"),
        supabase.from("funnel_campaigns").select("funil, campaign_id"),
      ]);
      setLeads((leadsRes.data as Lead[]) || []);
      setMetaAds((metaRes.data as MetaCacheRow[]) || []);
      setTouches((touchesRes.data as TouchWithCampaign[]) || []);
      setFunnelCampaigns((fcRes.data as FunnelCampaignLink[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const funilOptions = useMemo(() => {
    const unique = [...new Set(leads.map((l) => l.funil).filter(Boolean))] as string[];
    return unique.sort();
  }, [leads]);

  const funnelMetrics = useMemo(() => {
    const { current } = getPeriodRange(period);
    return computeFunnelMetrics(touches, metaAds, funnelCampaigns, current);
  }, [touches, metaAds, funnelCampaigns, period]);

  const funnelMetricsPrev = useMemo(() => {
    const { previous } = getPeriodRange(period);
    return computeFunnelMetrics(touches, metaAds, funnelCampaigns, previous);
  }, [touches, metaAds, funnelCampaigns, period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">KPIs de vendas e marketing.</p>
        </div>
        {tab !== "vendas" && (
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
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          {loading ? <LoadingCards /> : (
            <GeralTab
              leads={leads}
              touches={touches}
              funnelMetrics={funnelMetrics}
              funnelMetricsPrev={funnelMetricsPrev}
              period={period}
              selectedFunil={selectedFunil}
            />
          )}
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          {loading ? <LoadingCards /> : (
            <MarketingTab
              leads={leads}
              touches={touches}
              funnelMetrics={funnelMetrics}
              funnelCampaigns={funnelCampaigns}
              period={period}
              selectedFunil={selectedFunil}
            />
          )}
        </TabsContent>

        <TabsContent value="vendas" className="mt-4">
          <VendasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function LoadingCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="flex-1 animate-pulse">
          <CardContent className="pt-4 pb-4 px-4 h-[110px]" />
        </Card>
      ))}
    </div>
  );
}

export default DashboardPage;
