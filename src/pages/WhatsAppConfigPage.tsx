import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Loader2, MessageCircle, LogOut } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import {
  useWhatsAppConfig,
  useConnectWhatsApp,
  useTestWhatsAppConnection,
  useDisconnectWhatsApp,
} from "@/hooks/useWhatsAppConfig";

const WhatsAppConfigPage = () => {
  const navigate = useNavigate();

  const { data: config, isLoading } = useWhatsAppConfig();
  const connect = useConnectWhatsApp();
  const test = useTestWhatsAppConnection();
  const disconnect = useDisconnectWhatsApp();

  const conectado = Boolean(config?.token_configurado && config?.ativo);

  const handleConnect = () => {
    connect.mutate(undefined, {
      onSuccess: () => toast.success("WhatsApp conectado com sucesso!"),
      onError: (err) => toast.error(getErrorMessage(err, "Erro ao conectar")),
    });
  };

  const handleTest = () => {
    test.mutate(undefined, {
      onSuccess: (data) => {
        const numero = data.display_phone_number ?? "número conectado";
        const nome = data.verified_name ? ` (${data.verified_name})` : "";
        toast.success(`Conexão ativa: ${numero}${nome}`);
      },
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível validar a conexão")),
    });
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success("WhatsApp desconectado"),
      onError: (err) => toast.error(getErrorMessage(err, "Erro ao desconectar")),
    });
  };

  if (isLoading) {
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
          <h2 className="text-2xl font-bold text-foreground">Integração WhatsApp</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Conecte sua conta WhatsApp Business para enviar e receber mensagens com seus leads.
          </p>
        </div>
      </div>

      {/* Connection status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexão WhatsApp Business</CardTitle>
        </CardHeader>
        <CardContent>
          {conectado ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#25D366] flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {config?.verified_name ?? "WhatsApp Business"}
                    </p>
                    {config?.display_phone_number && (
                      <p className="text-xs text-muted-foreground">{config.display_phone_number}</p>
                    )}
                  </div>
                </div>
                <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                  Conectado
                </Badge>
              </div>

              {config?.waba_id && (
                <div className="text-xs text-muted-foreground">
                  WABA ID: <span className="font-mono">{config.waba_id}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={test.isPending}>
                  {test.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Testar conexão
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnect.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnect.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta WhatsApp Business para enviar e receber mensagens diretamente do CRM.
              </p>
              <Button
                onClick={handleConnect}
                disabled={connect.isPending}
                className="bg-[#25D366] hover:bg-[#1FB855] text-white"
              >
                {connect.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                Conectar WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConfigPage;
