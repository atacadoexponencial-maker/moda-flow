import { useMemo, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useWhatsAppInbox } from "@/hooks/useWhatsAppInbox";
import { LeadDetailPanel } from "@/components/pipeline/LeadDetailPanel";
import { getStageLabel } from "@/lib/constants";
import { assigneeInitials, assigneeLabel, canAssume, assignPatch } from "@/lib/team";
import { ASSIGNEE_ALL, ASSIGNEE_ME, ASSIGNEE_NONE } from "@/lib/leads-filter-utils";
import { filterInbox, isUnanswered, EMPTY_INBOX_FILTERS, type InboxFilters, type InboxItem } from "@/lib/whatsapp-inbox";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

function when(iso: string | null): string {
  if (!iso) return "";
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM", { locale: ptBR });
}

export default function ConversasPage() {
  const { user } = useAuth();
  const { data: members = [] } = useTeamMembers();
  const { items, isLoading } = useWhatsAppInbox();
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_INBOX_FILTERS);
  const [selected, setSelected] = useState<Lead | null>(null);

  const list = useMemo(() => filterInbox(items, filters, user?.id), [items, filters, user?.id]);
  const unanswered = useMemo(() => items.filter(isUnanswered).length, [items]);

  const open = async (c: InboxItem) => {
    const { data, error } = await supabase.from("leads").select("*").eq("id", c.lead_id).single();
    if (error || !data) { toast.error("Lead não encontrado"); return; }
    setSelected(data);
  };

  const assume = async (c: InboxItem) => {
    if (!user) return;
    const { error } = await supabase.from("leads").update(assignPatch(user.id)).eq("id", c.lead_id);
    if (error) toast.error("Erro ao assumir");
    else toast.success(`Você assumiu ${c.lead.nome}`);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground">Conversas</h2>
        <p className="text-sm text-muted-foreground">
          {items.length} conversa{items.length === 1 ? "" : "s"} · {unanswered} sem resposta
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar nome ou telefone…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="h-9 w-64"
        />
        <Tabs value={filters.scope} onValueChange={(v) => setFilters((f) => ({ ...f, scope: v }))}>
          <TabsList className="h-9">
            <TabsTrigger value={ASSIGNEE_ME} className="text-xs">Minhas</TabsTrigger>
            <TabsTrigger value={ASSIGNEE_NONE} className="text-xs">Sem responsável</TabsTrigger>
            <TabsTrigger value={ASSIGNEE_ALL} className="text-xs">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant={filters.unansweredOnly ? "default" : "outline"}
          size="sm"
          className="h-9"
          aria-pressed={filters.unansweredOnly}
          onClick={() => setFilters((f) => ({ ...f, unansweredOnly: !f.unansweredOnly }))}
        >
          Não respondidas
        </Button>
      </div>

      <Card className="divide-y">
        {isLoading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Nenhuma conversa com esses filtros.
          </div>
        ) : (
          list.map((c) => {
            const ini = assigneeInitials(members, c.lead.assigned_to);
            const bold = c.unread_count > 0;
            return (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer" onClick={() => open(c)}>
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                  {c.lead.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm ${bold ? "font-semibold text-foreground" : "text-foreground"}`}>{c.lead.nome}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{getStageLabel(c.lead.status)}</Badge>
                  </div>
                  <p className={`truncate text-xs ${bold ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.last_message_direction === "enviada" && <span className="text-muted-foreground">Você: </span>}
                    {c.last_message_text}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{when(c.last_message_at)}</span>
                  <div className="flex items-center gap-1.5">
                    {ini ? (
                      <span title={assigneeLabel(members, c.lead.assigned_to)} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                        {ini}
                      </span>
                    ) : (
                      canAssume({ assigned_to: c.lead.assigned_to }, user?.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={(e) => { e.stopPropagation(); assume(c); }}
                        >
                          Assumir
                        </Button>
                      )
                    )}
                    {c.unread_count > 0 && (
                      <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1.5">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <LeadDetailPanel lead={selected} open={!!selected} onClose={() => setSelected(null)} initialTab="conversa" />
    </div>
  );
}
