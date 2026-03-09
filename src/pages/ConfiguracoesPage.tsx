import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";

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
    </div>
  );
};

export default ConfiguracoesPage;
