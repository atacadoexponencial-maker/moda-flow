import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import { useSyncWhatsAppTemplates, useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import {
  templateParts,
  TEMPLATE_STATUS_LABEL,
  TEMPLATE_CATEGORY_LABEL,
} from "../../../supabase/functions/_shared/whatsapp-templates";

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "APPROVED": return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    case "REJECTED":
    case "DISABLED": return "bg-destructive/10 text-destructive border-destructive/30";
    case "PAUSED": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    default: return "";
  }
}

/** Lista de templates sincronizados da Meta (Configurações › WhatsApp). */
export function TemplatesCard() {
  const { data: templates = [], isLoading } = useWhatsAppTemplates();
  const sync = useSyncWhatsAppTemplates();
  const lastSync = templates.reduce<string | null>((acc, t) => (!acc || t.synced_at > acc ? t.synced_at : acc), null);

  const onSync = () =>
    sync.mutate(undefined, {
      onSuccess: (n) => toast.success(`${n} template(s) sincronizado(s)`),
      onError: (e) => toast.error(getErrorMessage(e, "Falha ao sincronizar")),
    });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="text-base">Templates</CardTitle>
          <CardDescription>
            Criados e aprovados no WhatsApp Manager. Usados fora da janela de 24 horas.
            {lastSync && ` Última sincronização: ${format(parseISO(lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })}.`}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onSync} disabled={sync.isPending}>
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar com a Meta
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 rounded bg-muted animate-pulse" />
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum template sincronizado ainda.</p>
        ) : (
          <ul className="divide-y">
            {templates.map((t) => {
              const parts = templateParts(t.components);
              return (
                <li key={t.id} className="py-2.5 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.language}</span>
                    {t.category && <span className="text-xs text-muted-foreground">· {TEMPLATE_CATEGORY_LABEL[t.category] ?? t.category}</span>}
                    <Badge variant="outline" className={`text-[10px] ${statusClass(t.status)}`}>
                      {TEMPLATE_STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{parts.body}</p>
                  {t.rejected_reason && <p className="text-xs text-destructive">Motivo: {t.rejected_reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
