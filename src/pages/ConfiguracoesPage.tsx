import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Megaphone, Link2, Users, Webhook } from "lucide-react";
import { useWebhookConfig } from "@/hooks/useWebhookConfig";

const ConfiguracoesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configurações</h2>
        <p className="text-muted-foreground mt-1">Configurações do sistema.</p>
      </div>

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
    </div>
  );
};

export default ConfiguracoesPage;
