import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Eye, EyeOff, RefreshCw, Webhook } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useWebhookConfig, useUpdateWebhookConfig } from "@/hooks/useWebhookConfig";
import { supabase } from "@/integrations/supabase/client";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-lead`;

const FIELDS = [
  { field: "nome", alternatives: "name", description: "Nome do lead (obrigatório)" },
  { field: "email", alternatives: "—", description: "E-mail" },
  { field: "whatsapp", alternatives: "phone, telefone", description: "WhatsApp/Telefone" },
  { field: "instagram", alternatives: "—", description: "Instagram" },
  { field: "status", alternatives: "—", description: "Status no CRM (padrão: leads_entrada)" },
  { field: "funil", alternatives: "funnel", description: "Funil" },
  { field: "produto", alternatives: "product", description: "Produto" },
  { field: "utm_source", alternatives: "source", description: "Origem" },
  { field: "utm_medium", alternatives: "medium", description: "Meio" },
  { field: "utm_campaign", alternatives: "campaign", description: "Campanha" },
  { field: "faturamento_mensal", alternatives: "faturamento", description: "Faturamento mensal" },
  { field: "oportunidade", alternatives: "valor", description: "Valor da oportunidade" },
];

const EXAMPLE_TYPEBOT = JSON.stringify(
  { nome: "{{nome}}", whatsapp: "{{whatsapp}}", email: "{{email}}", utm_source: "typebot" },
  null,
  2
);

const EXAMPLE_N8N = JSON.stringify(
  {
    nome: "João Silva",
    whatsapp: "11999999999",
    email: "joao@email.com",
    utm_source: "facebook",
    utm_campaign: "black-friday",
    oportunidade: 5000,
  },
  null,
  2
);

const EXAMPLE_CURL = `curl -X POST ${WEBHOOK_URL} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: SEU_TOKEN_AQUI" \\
  -d '{"nome": "Teste", "whatsapp": "11999999999"}'`;

const WebhookPage = () => {
  const navigate = useNavigate();
  const { data: config, isLoading } = useWebhookConfig();
  const updateConfig = useUpdateWebhookConfig();
  const [showToken, setShowToken] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleToggle = (enabled: boolean) => {
    updateConfig.mutate({ enabled });
    toast.success(enabled ? "Webhook ativado" : "Webhook desativado");
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      // Generate a random hex token client-side as fallback
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const newToken = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error } = await supabase
        .from("webhook_configs" as any)
        .update({ token: newToken } as any)
        .eq("id", config.id);

      if (error) throw error;
      toast.success("Token regenerado com sucesso!");
      // Refetch
      updateConfig.mutate({});
    } catch {
      toast.error("Erro ao regenerar token");
    } finally {
      setRegenerating(false);
      setRegenOpen(false);
    }
  };

  const maskedToken = config?.token
    ? `${config.token.slice(0, 6)}${"•".repeat(20)}${config.token.slice(-6)}`
    : "";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/configuracoes")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma configuração de webhook encontrada. Crie um registro na tabela webhook_configs.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Webhook className="h-6 w-6 text-primary" />
            Configuração do Webhook
          </h2>
          <p className="text-muted-foreground mt-1">Receba leads automaticamente de sistemas externos.</p>
        </div>
      </div>

      {/* URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL do Webhook</CardTitle>
          <CardDescription>Envie um POST para esta URL para criar leads no CRM.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={WEBHOOK_URL} className="font-mono text-sm" />
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(WEBHOOK_URL, "URL")}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token de Autenticação</CardTitle>
          <CardDescription>Envie no header <code className="bg-muted px-1 rounded text-xs">x-webhook-token</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              readOnly
              value={showToken ? config.token : maskedToken}
              className="font-mono text-sm"
            />
            <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(config.token, "Token")}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </div>
          <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" /> Regenerar Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Regenerar Token</DialogTitle>
                <DialogDescription>
                  O token atual será invalidado. Todas as integrações que usam o token antigo pararão de funcionar.
                  Tem certeza?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRegenOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleRegenerate} disabled={regenerating}>
                  {regenerating ? "Regenerando..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={config.enabled}
              onCheckedChange={handleToggle}
              disabled={updateConfig.isPending}
            />
            <span className="text-sm font-medium text-foreground">
              {config.enabled ? "Webhook ativo" : "Webhook desativado"}
            </span>
            <Badge variant={config.enabled ? "default" : "secondary"}>
              {config.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de leads recebidos</p>
            <p className="text-3xl font-bold text-foreground mt-1">{config.total_leads_received ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Último uso</p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {config.last_used_at
                ? formatDistanceToNow(new Date(config.last_used_at), { addSuffix: true, locale: ptBR })
                : "Nunca usado"}
            </p>
            {config.last_used_at && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(config.last_used_at), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accepted Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campos aceitos</CardTitle>
          <CardDescription>Campos que podem ser enviados no body JSON do POST.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo no payload</TableHead>
                <TableHead>Alternativas aceitas</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELDS.map((f) => (
                <TableRow key={f.field}>
                  <TableCell className="font-mono text-sm">{f.field}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{f.alternatives}</TableCell>
                  <TableCell className="text-sm">{f.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payload Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exemplos de payload</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="typebot">
            <TabsList>
              <TabsTrigger value="typebot">Typebot</TabsTrigger>
              <TabsTrigger value="n8n">n8n / Make</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="typebot">
              <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto">{EXAMPLE_TYPEBOT}</pre>
            </TabsContent>
            <TabsContent value="n8n">
              <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto">{EXAMPLE_N8N}</pre>
            </TabsContent>
            <TabsContent value="curl">
              <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">{EXAMPLE_CURL}</pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhookPage;
