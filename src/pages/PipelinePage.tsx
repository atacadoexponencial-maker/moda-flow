import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { WON_STAGES, LOST_STAGES, getStageLabel } from '@/lib/constants';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MoveDialog, type MoveDialogType } from '@/components/pipeline/MoveDialog';
import { LeadDetailPanel } from '@/components/pipeline/LeadDetailPanel';

type Lead = Tables<'leads'>;

const COLUMN_ORDER = [
  { value: 'leads_entrada', label: 'Leads de Entrada' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'follow_ra', label: 'Follow RA' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'proposta_negociacao', label: 'Proposta / Negociação' },
  { value: 'follow_rr', label: 'Follow RR' },
  { value: 'follow_futuro', label: 'Follow Futuro' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'contrato_assinado', label: 'Contrato Assinado ✅' },
  { value: 'desqualificado', label: 'Desqualificado ❌' },
  { value: 'proposta_recusada', label: 'Proposta Recusada ❌' },
];

function formatProximoContato(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (isToday(d)) return 'hoje';
  if (isTomorrow(d)) return 'amanhã';
  if (isYesterday(d)) return 'ontem';
  return format(d, 'dd/MM', { locale: ptBR });
}

function formatCurrency(value: number | null): string {
  if (!value) return 'R$ 0';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getHeaderStyle(status: string) {
  if ((WON_STAGES as readonly string[]).includes(status)) return 'bg-success text-success-foreground';
  if ((LOST_STAGES as readonly string[]).includes(status)) return 'bg-destructive text-destructive-foreground';
  return 'bg-muted text-muted-foreground';
}

function getDialogType(status: string): MoveDialogType | null {
  if (status === 'contrato_assinado') return 'arrecadado';
  if (status === 'desqualificado' || status === 'proposta_recusada') return 'loss_reason';
  if (status === 'follow_futuro' || status === 'nutricao') return 'data_proximo_contato';
  if (status === 'reuniao') return 'data_ra';
  return null;
}

// Draggable card
function DraggableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <LeadCardContent lead={lead} />
    </div>
  );
}

function LeadCardContent({ lead }: { lead: Lead }) {
  const proximo = formatProximoContato(lead.data_proximo_contato);
  return (
    <Card className="p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
      <p className="font-semibold text-sm text-foreground leading-tight truncate">{lead.nome}</p>
      {lead.faturamento_mensal && (
        <p className="text-xs text-muted-foreground truncate">{lead.faturamento_mensal}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.mql && <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">MQL</Badge>}
        {lead.sql_flag && <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">SQL</Badge>}
        {proximo && <span className="text-[10px] text-muted-foreground ml-auto">📅 {proximo}</span>}
      </div>
      {!!lead.oportunidade && (
        <p className="text-xs font-medium text-foreground">{formatCurrency(lead.oportunidade)}</p>
      )}
    </Card>
  );
}

// Droppable column
function DroppableColumn({ stage, leads, isOver }: { stage: typeof COLUMN_ORDER[number]; leads: Lead[]; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: stage.value });
  const total = leads.length;
  const somaOp = leads.reduce((s, l) => s + (Number(l.oportunidade) || 0), 0);

  return (
    <div ref={setNodeRef} className="flex flex-col w-64 min-w-[16rem] shrink-0">
      <div className={`rounded-t-lg px-3 py-2 ${getHeaderStyle(stage.value)}`}>
        <p className="font-semibold text-sm leading-tight">{stage.label}</p>
        <p className="text-xs mt-0.5 opacity-90">{total} lead{total !== 1 ? 's' : ''} · {formatCurrency(somaOp)}</p>
      </div>
      <div className={cn(
        'flex-1 rounded-b-lg p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-13rem)] transition-colors',
        isOver ? 'bg-accent/20 ring-2 ring-accent' : 'bg-muted/40'
      )}>
        {leads.map(lead => <DraggableLeadCard key={lead.id} lead={lead} />)}
        {total === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum lead</p>}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [pendingMove, setPendingMove] = useState<{ lead: Lead; from: string; to: string } | null>(null);
  const [dialogType, setDialogType] = useState<MoveDialogType | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*');
      if (error) throw error;
      return data as Lead[];
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, from, to, extra }: { leadId: string; from: string; to: string; extra?: Record<string, unknown> }) => {
      const updateData: Record<string, unknown> = { status: to, ...extra };
      const { error: updateError } = await supabase.from('leads').update(updateData).eq('id', leadId);
      if (updateError) throw updateError;

      const content = `Status alterado de ${getStageLabel(from)} para ${getStageLabel(to)}`;
      const { error: actError } = await supabase.from('activities').insert({ lead_id: leadId, type: 'status_change', content });
      if (actError) throw actError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-pipeline'] });
      toast.success('Lead movido com sucesso');
    },
    onError: () => {
      toast.error('Erro ao mover lead');
      queryClient.invalidateQueries({ queryKey: ['leads-pipeline'] });
    },
  });

  const executeMove = useCallback((lead: Lead, from: string, to: string, extra?: Record<string, unknown>) => {
    moveMutation.mutate({ leadId: lead.id, from, to, extra });
  }, [moveMutation]);

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find(l => l.id === event.active.id);
    setActiveLead(lead ?? null);
  };

  const handleDragOver = (event: any) => {
    setOverColumn(event.over?.id as string ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    setOverColumn(null);
    const { active, over } = event;
    if (!over) return;

    const lead = leads.find(l => l.id === active.id);
    if (!lead) return;

    const from = lead.status;
    const to = over.id as string;
    if (from === to) return;

    const dtype = getDialogType(to);
    if (dtype) {
      setPendingMove({ lead, from, to });
      setDialogType(dtype);
    } else {
      executeMove(lead, from, to);
    }
  };

  const handleDialogConfirm = (data: Record<string, unknown>) => {
    if (!pendingMove) return;
    executeMove(pendingMove.lead, pendingMove.from, pendingMove.to, data);
    setPendingMove(null);
    setDialogType(null);
  };

  const handleDialogCancel = () => {
    setPendingMove(null);
    setDialogType(null);
  };

  const grouped = COLUMN_ORDER.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.value] = leads.filter(l => l.status === col.value);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Pipeline</h2>
        <p className="text-muted-foreground mt-1">Arraste os cards para mover leads entre etapas.</p>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-64 min-w-[16rem] shrink-0 h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <ScrollArea className="w-full">
            <div className="flex gap-3 pb-4 pr-4">
              {COLUMN_ORDER.map(stage => (
                <DroppableColumn
                  key={stage.value}
                  stage={stage}
                  leads={grouped[stage.value]}
                  isOver={overColumn === stage.value}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <DragOverlay>
            {activeLead && (
              <div className="w-60 opacity-90 rotate-2">
                <LeadCardContent lead={activeLead} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {dialogType && pendingMove && (
        <MoveDialog
          open
          type={dialogType}
          targetStage={pendingMove.to}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}
    </div>
  );
}
