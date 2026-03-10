import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X, Loader2, AlertTriangle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { getStageLabel } from "@/lib/constants";

interface FunnelCampaign {
  id: string;
  funil: string;
  campaign_id: string;
  campaign_name: string;
}

interface CampaignOption {
  campaign_id: string;
  campaign_name: string;
}

const FunnelCampaignsPage = () => {
  const navigate = useNavigate();

  const [funnels, setFunnels] = useState<string[]>([]);
  const [funnelCampaigns, setFunnelCampaigns] = useState<FunnelCampaign[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [funnelsRes, campaignsRes, cacheRes] = await Promise.all([
        supabase.from("leads").select("funil").not("funil", "is", null),
        supabase.from("funnel_campaigns" as any).select("*"),
        supabase.from("meta_ads_cache").select("campaign_id, campaign_name"),
      ]);

      // Distinct funnels from leads
      const uniqueFunnels = [
        ...new Set((funnelsRes.data || []).map((l) => l.funil).filter(Boolean)),
      ] as string[];
      setFunnels(uniqueFunnels.sort());

      setFunnelCampaigns((campaignsRes.data as any as FunnelCampaign[]) || []);

      // Distinct campaigns from cache
      const campaignMap = new Map<string, string>();
      for (const row of cacheRes.data || []) {
        if (row.campaign_id && row.campaign_name) {
          campaignMap.set(row.campaign_id, row.campaign_name);
        }
      }
      setAvailableCampaigns(
        Array.from(campaignMap, ([campaign_id, campaign_name]) => ({
          campaign_id,
          campaign_name,
        })).sort((a, b) => a.campaign_name.localeCompare(b.campaign_name))
      );
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async (funil: string, campaignId: string) => {
    const campaign = availableCampaigns.find((c) => c.campaign_id === campaignId);
    if (!campaign) return;

    const { error } = await supabase.from("funnel_campaigns" as any).insert({
      funil,
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
    } as any);

    if (error) {
      toast.error("Erro ao vincular campanha");
      return;
    }

    toast.success("Campanha vinculada");
    setAddingTo(null);
    loadData();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("funnel_campaigns" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover vínculo");
      return;
    }
    toast.success("Vínculo removido");
    loadData();
  };

  const getCampaignsForFunnel = (funil: string) =>
    funnelCampaigns.filter((fc) => fc.funil === funil);

  const getAvailableForFunnel = (funil: string) => {
    const linked = new Set(getCampaignsForFunnel(funil).map((fc) => fc.campaign_id));
    return availableCampaigns.filter((c) => !linked.has(c.campaign_id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noFunnels = funnels.length === 0;
  const noCampaigns = availableCampaigns.length === 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Vincular Campanhas Meta</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Associe campanhas do Meta Ads aos funis do CRM para calcular CPL e ROAS.
          </p>
        </div>
      </div>

      {noCampaigns && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Sincronize as campanhas Meta primeiro em{" "}
              <button
                onClick={() => navigate("/configuracoes/meta-ads")}
                className="underline font-medium hover:no-underline"
              >
                Integração Meta Ads
              </button>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {noFunnels && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Nenhum funil encontrado. Importe leads para ver os funis disponíveis.
            </p>
          </CardContent>
        </Card>
      )}

      {funnels.map((funil) => {
        const linked = getCampaignsForFunnel(funil);
        const available = getAvailableForFunnel(funil);
        const isAdding = addingTo === funil;

        return (
          <Card key={funil}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                {getStageLabel(funil)}
                {linked.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {linked.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {linked.length === 0 && !isAdding && (
                <p className="text-sm text-muted-foreground">Nenhuma campanha vinculada.</p>
              )}

              {linked.map((fc) => (
                <div
                  key={fc.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {fc.campaign_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{fc.campaign_id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemove(fc.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {isAdding ? (
                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={(val) => handleAdd(funil, val)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar campanha..." />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((c) => (
                        <SelectItem key={c.campaign_id} value={c.campaign_id}>
                          {c.campaign_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddingTo(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingTo(funil)}
                  disabled={noCampaigns || available.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar campanha
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default FunnelCampaignsPage;
