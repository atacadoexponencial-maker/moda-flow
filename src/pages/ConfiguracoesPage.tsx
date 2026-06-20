import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Megaphone, Link2, Users, Columns, Webhook, MessageCircle } from "lucide-react";
import { useWebhookConfig } from "@/hooks/useWebhookConfig";

const ConfiguracoesPage = () => {
  const navigate = useNavigate();
  const { data: webhookConfig } = useWebhookConfig();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configurações</h2>
        <p className="text-muted-foreground mt-1">Configurações do sistema.</p>
      </div>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/configuracoes/campos")}>
        <CardContent className="flex items-center gap-4 py-5">
          <Columns className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-foreground">Campos do CRM</p>
            <p className="text-sm text-muted-foreground">Gerencie os campos exibidos na tabela de leads e adicione campos personalizados.</p>
          </div>
          <Button variant="outline" className="ml-auto" size="sm">Configurar</Button>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/configuracoes/importar")}>
        <CardContent className="flex items-center gap-4 py-5">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-foreground">Importar Leads</p>
            <p className="text-sm text-muted-foreground">Faça upload de um CSV para importar leads em massa.</p>
          </div>
          <Button variant="outline" className="ml-auto" size="sm">Importar</Button>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/configuracoes/meta-ads")}>
        <CardContent className="flex items-center gap-4 py-5">
          <Megaphone className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-foreground">Integração Meta Ads</p>
            <p className="text-sm text-muted-foreground">Configure o acesso à API do Meta para sincronizar dados de investimento.</p>
          </div>
          <Button variant="outline" className="ml-auto" size="sm">Configurar</Button>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/configuracoes/whatsapp")}>
        <CardContent className="flex items-center gap-4 py-5">
          <MessageCircle className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-foreground">Integração WhatsApp</p>
            <p className="text-sm text-muted-foreground">Conecte sua conta WhatsApp Business para enviar e receber mensagens com seus leads.</p>
          </div>
          <Button variant="outline" className="ml-auto" size="sm">Configurar</Button>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/configuracoes/vincular-campanhas")}>
        <CardContent className="flex items-center gap-4 py-5">
          <Link2 className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-foreground">Vincular Campanhas Meta</p>
            <p className="text-sm text-muted-foreground">Associe campanhas do Meta Ads aos funis do CRM para calcular CPL e ROAS.</p>
          </div>
          <Button variant="outline" className="ml-auto" size="sm">Configurar</Button>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/configuracoes/usuarios")}>
        <CardContent className="flex items-center gap-4 py-5">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-foreground">Usuários</p>
            <p className="text-sm text-muted-foreground">Gerencie usuários e permissões do sistema.</p>
          </div>
          <Button variant="outline" className="ml-auto" size="sm">Gerenciar</Button>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/configuracoes/webhook")}>
        <CardContent className="flex items-center gap-4 py-5">
          <Webhook className="h-8 w-8 text-primary" />
          <div className="flex items-center gap-2">
            <div>
              <p className="font-medium text-foreground">Webhook</p>
              <p className="text-sm text-muted-foreground">Receba leads de Typebot, n8n, Make e formulários externos.</p>
            </div>
            <Badge variant={webhookConfig?.enabled ? "default" : "secondary"}>
              {webhookConfig?.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <Button variant="outline" className="ml-auto" size="sm">Configurar</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesPage;
