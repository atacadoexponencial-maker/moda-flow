import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Plug, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MetaAdsConfigPage = () => {
  const navigate = useNavigate();

  const [adAccountId, setAdAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [tokenConfigurado, setTokenConfigurado] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [testResult, setTestResult] = useState<{ success: boolean; name?: string; error?: string } | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState<number>(0);

  useEffect(() => {
    loadConfig();
    loadSyncInfo();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("meta_config_safe" as any)
        .select("*")
        .limit(1)
        .single();

      if (data && !error) {
        setAdAccountId((data as any).ad_account_id ?? "");
        setAtivo((data as any).ativo ?? false);
        setTokenConfigurado((data as any).token_configurado ?? false);
      }
    } catch {
      // No config yet — that's fine
    } finally {
      setLoading(false);
    }
  };

  const loadSyncInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("meta_ads_cache")
        .select("fetched_at, campaign_id")
        .order("fetched_at", { ascending: false })
        .limit(1000);

      if (data && !error && data.length > 0) {
        setLastSync(data[0].fetched_at);
        const uniqueCampaigns = new Set(data.map((r) => r.campaign_id));
        setSyncedCount(uniqueCampaigns.size);
      }
    } catch {
      // No cache yet
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ad_account_id: adAccountId,
        ativo,
      };
      if (accessToken.trim()) {
        body.access_token = accessToken;
      }

      const { data, error } = await supabase.functions.invoke("meta-save-config", {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Configuração salva com sucesso");
      setAccessToken("");
      await loadConfig();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-test-connection");

      if (error) throw error;

      setTestResult(data);
      if (data?.success) {
        toast.success(`Conectado como: ${data.name}`);
      } else {
        toast.error(data?.error || "Conexão falhou");
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
      toast.error(err.message || "Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-fetch-insights");

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${data.campaigns_synced} registros sincronizados`);
      await loadSyncInfo();
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Integração Meta Ads</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure o acesso à API do Meta para sincronizar dados de investimento.
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="access_token">Access Token</Label>
            <Input
              id="access_token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={
                tokenConfigurado
                  ? "•••••••• Token configurado"
                  : "Cole o access token do Meta aqui"
              }
            />
            {tokenConfigurado && (
              <p className="text-xs text-muted-foreground">
                Token já configurado. Deixe em branco para manter o atual.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad_account_id">Ad Account ID</Label>
            <Input
              id="ad_account_id"
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              placeholder="act_123456789"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Integração ativa</Label>
              <p className="text-xs text-muted-foreground">Habilita a sincronização automática</p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={testing || !tokenConfigurado}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              Testar conexão
            </Button>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                testResult.success
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Conectado como <strong>{testResult.name}</strong></span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{testResult.error}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                Última sincronização:{" "}
                <span className="text-muted-foreground">
                  {lastSync
                    ? format(new Date(lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "Nunca"}
                </span>
              </p>
              {syncedCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {syncedCount} campanha{syncedCount !== 1 ? "s" : ""} sincronizada{syncedCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={handleSync} disabled={syncing || !ativo}>
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar agora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaAdsConfigPage;
