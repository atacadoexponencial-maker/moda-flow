import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addWeeks, endOfWeek, format, parseISO, startOfDay, startOfWeek, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarCheck, CheckCircle2, UserX } from "lucide-react";
import { getStageLabel } from "@/lib/constants";
import { LeadDetailPanel } from "@/components/pipeline/LeadDetailPanel";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface ActivityRow {
  lead_id: string;
  content: string | null;
  created_at: string;
}

const HOT_STATUSES = ["proposta_negociacao", "contrato"] as const;

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function inWeek(dateStr: string | null, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const d = startOfDay(parseISO(dateStr));
  return d >= from && d <= to;
}

export function VendasTab() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["vendas-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*");
      if (error) throw error;
      return (data as Lead[]) || [];
    },
  });

  const { data: statusActivities = [] } = useQuery({
    queryKey: ["vendas-status-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("lead_id, content, created_at")
        .eq("type", "status_change");
      if (error) throw error;
      return (data as ActivityRow[]) || [];
    },
  });

  const semana = useMemo(() => {
    const realizadas = leads
      .filter((l) => inWeek(l.data_rr, weekStart, weekEnd))
      .sort((a, b) => (a.data_rr || "").localeCompare(b.data_rr || ""));

    const agendadas = leads.filter((l) => inWeek(l.data_ra, weekStart, weekEnd));

    const noShows = leads.filter((l) => l.no_show && inWeek(l.data_ra, weekStart, weekEnd));

    const taxa = agendadas.length > 0 ? (realizadas.length / agendadas.length) * 100 : null;

    // Motivos de no-show
    const motivos = new Map<string, number>();
    for (const l of noShows) {
      const m = l.no_show_motivo || "Não informado";
      motivos.set(m, (motivos.get(m) ?? 0) + 1);
    }
    const motivosSorted = [...motivos.entries()].sort((a, b) => b[1] - a[1]);

    // Propostas fechadas na semana: mudança de status para Contrato Assinado
    const fechadaIds = new Set(
      statusActivities
        .filter(
          (a) =>
            a.content?.includes("para Contrato Assinado") &&
            inWeek(a.created_at, weekStart, weekEnd),
        )
        .map((a) => a.lead_id),
    );
    const fechadas = leads.filter((l) => l.status === "contrato_assinado" && fechadaIds.has(l.id));
    const totalFechado = fechadas.reduce((s, l) => s + (l.arrecadado || 0), 0);

    return { realizadas, agendadas, noShows, taxa, motivosSorted, fechadas, totalFechado };
  }, [leads, statusActivities, weekStart, weekEnd]);

  // Propostas quentes: estado atual, independente da semana
  const quentes = useMemo(() => {
    const list = leads
      .filter((l) => (HOT_STATUSES as readonly string[]).includes(l.status))
      .sort((a, b) => (b.oportunidade || 0) - (a.oportunidade || 0));
    const total = list.reduce((s, l) => s + (l.oportunidade || 0), 0);
    return { list, total };
  }, [leads]);

  const maxMotivo = semana.motivosSorted[0]?.[1] ?? 0;

  const weekLabel = `${format(weekStart, "dd/MM", { locale: ptBR })} – ${format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}`;
  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime() === weekStart.getTime();

  const LeadRow = ({ lead, right }: { lead: Lead; right?: React.ReactNode }) => (
    <button
      onClick={() => setSelectedLead(lead)}
      className="w-full flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded hover:bg-muted/50 text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
        <p className="text-xs text-muted-foreground truncate">
          {lead.funil || "(sem funil)"} · {getStageLabel(lead.status)}
        </p>
      </div>
      {right}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Seletor de semana */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[170px] text-center">
            Semana {weekLabel}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            disabled={isCurrentWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Semana atual
            </Button>
          )}
        </div>
      </div>

      {/* Resumo da semana */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agendadas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{semana.agendadas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Realizadas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{semana.realizadas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comparecimento</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {semana.taxa !== null ? `${semana.taxa.toFixed(0)}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reuniões realizadas */}
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Reuniões realizadas na semana</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4">Carregando…</p>
            ) : semana.realizadas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma reunião realizada nesta semana.</p>
            ) : (
              <div className="divide-y">
                {semana.realizadas.map((l) => (
                  <LeadRow
                    key={l.id}
                    lead={l}
                    right={
                      <span className="text-xs text-muted-foreground shrink-0">
                        {l.data_rr ? format(parseISO(l.data_rr), "EEE dd/MM", { locale: ptBR }) : ""}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* No-shows */}
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">No-shows da semana</h3>
            {semana.noShows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhum no-show nesta semana.</p>
            ) : (
              <>
                <div className="divide-y mb-4">
                  {semana.noShows.map((l) => (
                    <LeadRow
                      key={l.id}
                      lead={l}
                      right={
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {l.no_show_motivo || "Não informado"}
                        </Badge>
                      }
                    />
                  ))}
                </div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Motivos
                </h4>
                <div className="space-y-1.5">
                  {semana.motivosSorted.map(([motivo, count]) => (
                    <div key={motivo} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-44 truncate" title={motivo}>{motivo}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${maxMotivo > 0 ? (count / maxMotivo) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-5 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Propostas fechadas */}
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Propostas fechadas na semana</h3>
              <span className="text-sm font-bold text-emerald-600">{fmtCurrency(semana.totalFechado)}</span>
            </div>
            {semana.fechadas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma proposta fechada nesta semana.</p>
            ) : (
              <div className="divide-y">
                {semana.fechadas.map((l) => (
                  <LeadRow
                    key={l.id}
                    lead={l}
                    right={
                      <span className="text-sm font-semibold text-emerald-600 shrink-0">
                        {fmtCurrency(l.arrecadado || 0)}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Propostas quentes */}
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Propostas quentes</h3>
              <span className="text-sm font-bold text-foreground">{fmtCurrency(quentes.total)}</span>
            </div>
            {quentes.list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma proposta em andamento.</p>
            ) : (
              <div className="divide-y">
                {quentes.list.map((l) => (
                  <LeadRow
                    key={l.id}
                    lead={l}
                    right={
                      <span className="text-sm font-semibold text-foreground shrink-0">
                        {fmtCurrency(l.oportunidade || 0)}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LeadDetailPanel lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
