import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, RefreshCw, Loader2, LogIn, LogOut, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const MetaAdsConfigPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [adAccountId, setAdAccountId] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [tokenConfigurado, setTokenConfigurado] = useState(false);
  const [metaUserName, setMetaUserName] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState<number>(0);

  useEffect(() => {
    const metaParam = searchParams.get("meta");
    if (metaParam === "conectado") {
      toast.success("Conta Meta conectada com sucesso!");
      setSearchParams({}, { replace: true });
    } else if (metaParam === "erro") {
      const msg = searchParams.get("msg") || "Erro ao conectar";
      toast.error(`Falha na conexão: ${msg}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadConfig();
    loadSyncInfo();
  }, []);

  // Reload config after OAuth redirect
  useEffect(() => {
    const metaParam = searchParams.get("meta");
    if (metaParam === "conectado") {
      loadConfig();
    }
  }, [searchParams]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("meta_config_safe")
        .select("*")
        .limit(1)
        .single();

      if (data && !error) {
        setAdAccountId(data.ad_account_id ?? "");
        setAtivo(data.ativo ?? false);
        setTokenConfigurado(data.token_configurado ?? false);
        setMetaUserName(data.meta_user_name ?? null);
        setTokenExpiresAt(data.token_expires_at ?? null);
      }
    } catch {
      // No config yet
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

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-start");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao iniciar conexão"));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-disconnect");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Conta Meta desconectada");
      setTokenConfigurado(false);
      setMetaUserName(null);
      setTokenExpiresAt(null);
      await loadConfig();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao desconectar"));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-save-config", {
        body: { ad_account_id: adAccountId, ativo },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Configuração salva com sucesso");
      await loadConfig();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao salvar configuração"));
    } finally {
      setSaving(false);
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
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao sincronizar"));
    } finally {
      setSyncing(false);
    }
  };

  const getTokenStatus = () => {
    if (!tokenExpiresAt) return null;
    const expiresDate = new Date(tokenExpiresAt);
    const daysLeft = differenceInDays(expiresDate, new Date());

    if (daysLeft <= 0) {
      return { label: "Token expirado", variant: "destructive" as const };
    }
    if (daysLeft <= 15) {
      return { label: `Expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`, variant: "warning" as const };
    }
    return { label: "Conectado", variant: "success" as const };
  };

  const tokenStatus = tokenConfigurado ? getTokenStatus() : null;

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
            Conecte sua conta Meta Business para sincronizar dados de investimento.
          </p>
        </div>
      </div>

      {/* Connection status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexão Meta Business</CardTitle>
        </CardHeader>
        <CardContent>
          {tokenConfigurado && metaUserName ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#1877F2] flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{metaUserName}</p>
                    {tokenExpiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Token válido até {format(new Date(tokenExpiresAt), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                {tokenStatus && (
                  <Badge
                    variant={tokenStatus.variant === "success" ? "default" : tokenStatus.variant === "warning" ? "secondary" : "destructive"}
                    className={
                      tokenStatus.variant === "success"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
                        : tokenStatus.variant === "warning"
                          ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                          : ""
                    }
                  >
                    {tokenStatus.label}
                  </Badge>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Reconectar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="text-destructive hover:text-destructive">
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta Meta Business para importar dados de campanhas automaticamente.
              </p>
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Conectar com Meta Business
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
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
            <Button variant="outline" onClick={handleSync} disabled={syncing || !ativo || !tokenConfigurado}>
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
