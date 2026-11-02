import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RefreshCw, Loader2, MessageCircle, LogOut, Replace } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import { qualityLabel } from "../../supabase/functions/_shared/whatsapp-connection";
import { TemplatesCard } from "@/components/whatsapp/TemplatesCard";
import {
  useWhatsAppConfig,
  useConnectWhatsApp,
  useTestWhatsAppConnection,
  useDisconnectWhatsApp,
} from "@/hooks/useWhatsAppConfig";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

function ConnectForm({
  defaultWaba,
  onDone,
  onCancel,
}: {
  defaultWaba?: string | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const connect = useConnectWhatsApp();
  const [waba, setWaba] = useState(defaultWaba ?? "");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");

  const submit = () => {
    connect.mutate(
      { waba_id: waba.trim(), phone_number_id: phone.trim(), access_token: token.trim() },
      {
        onSuccess: () => {
          setToken("");
          toast.success("WhatsApp conectado");
          onDone();
        },
        onError: (err) => toast.error(getErrorMessage(err, "Não foi possível conectar")),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="waba">WABA ID</Label>
          <Input id="waba" inputMode="numeric" value={waba} onChange={(e) => setWaba(e.target.value)} placeholder="Ex.: 1234567890" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Identificador do número</Label>
          <Input id="phone" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number ID" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="token">Token do usuário de sistema</Label>
        <Input
          id="token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Cole o token permanente"
        />
        <p className="text-xs text-muted-foreground">O token fica guardado só no servidor e não volta a ser exibido.</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={connect.isPending || !waba || !phone || !token}>
          {connect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Conectar
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={connect.isPending}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

function Instructions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Onde encontrar cada dado</CardTitle>
        <CardDescription>Tudo no portfólio da empresa no Meta Business Suite.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            <span className="text-foreground">WABA ID e identificador do número:</span> no app da Meta, em WhatsApp › Configuração da API
            (ou em WhatsApp Manager › Números de telefone).
          </li>
          <li>
            <span className="text-foreground">Token:</span> Configurações do negócio › Usuários do sistema › gerar token para o app, com as
            permissões <code className="text-xs">whatsapp_business_messaging</code> e <code className="text-xs">whatsapp_business_management</code>,
            sem expiração. O usuário de sistema precisa ter acesso à conta do WhatsApp.
          </li>
          <li>
            <span className="text-foreground">Webhook:</span> no app, em WhatsApp › Configuração, use a URL abaixo e o token de verificação
            combinado com o administrador do CRM. Assine o campo <code className="text-xs">messages</code>.
          </li>
        </ol>
        <p className="font-mono text-xs break-all bg-muted rounded px-2 py-1.5 text-foreground">{WEBHOOK_URL}</p>
      </CardContent>
    </Card>
  );
}

const WhatsAppConfigPage = () => {
  const navigate = useNavigate();
  const { data: config, isLoading } = useWhatsAppConfig();
  const test = useTestWhatsAppConnection();
  const disconnect = useDisconnectWhatsApp();
  const [replacing, setReplacing] = useState(false);

  const conectado = Boolean(config?.token_configurado && config?.ativo);

  const handleTest = () => {
    test.mutate(undefined, {
      onSuccess: (data) => {
        const numero = data.display_phone_number ?? "número conectado";
        const nome = data.verified_name ? ` (${data.verified_name})` : "";
        toast.success(`Conexão ativa: ${numero}${nome} · qualidade ${qualityLabel(data.quality_rating)}`);
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
            Número da empresa na API oficial da Meta, para conversar com os leads dentro do CRM.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Número conectado</CardTitle>
        </CardHeader>
        <CardContent>
          {conectado && !replacing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#25D366] flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{config?.verified_name ?? "WhatsApp Business"}</p>
                    {config?.display_phone_number && <p className="text-xs text-muted-foreground">{config.display_phone_number}</p>}
                  </div>
                </div>
                <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">Conectado</Badge>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Qualidade</dt>
                <dd className="text-foreground">{qualityLabel(config?.quality_rating)}</dd>
                <dt className="text-muted-foreground">Webhook assinado</dt>
                <dd className="text-foreground">
                  {config?.webhook_subscribed_at ? format(parseISO(config.webhook_subscribed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Não"}
                </dd>
                <dt className="text-muted-foreground">Conectado desde</dt>
                <dd className="text-foreground">
                  {config?.updated_at ? format(parseISO(config.updated_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </dd>
                <dt className="text-muted-foreground">WABA ID</dt>
                <dd className="font-mono text-foreground">{config?.waba_id}</dd>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={test.isPending}>
                  {test.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar conexão
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
                  <Replace className="h-4 w-4 mr-2" />
                  Trocar número
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnect.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {replacing && (
                <p className="text-sm text-muted-foreground">
                  Informe o novo número. As conversas já registradas continuam no histórico dos leads.
                </p>
              )}
              <ConnectForm
                defaultWaba={config?.waba_id}
                onDone={() => setReplacing(false)}
                onCancel={replacing ? () => setReplacing(false) : undefined}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {conectado && <TemplatesCard />}

      <Instructions />
    </div>
  );
};

export default WhatsAppConfigPage;
