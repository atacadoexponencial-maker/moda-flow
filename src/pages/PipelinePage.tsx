import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FUNNEL_STAGES, WON_STAGES, LOST_STAGES } from '@/lib/constants';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

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

function LeadCard({ lead }: { lead: Lead }) {
  const proximo = formatProximoContato(lead.data_proximo_contato);

  return (
    <Card className="p-3 space-y-2 cursor-default hover:shadow-md transition-shadow">
      <p className="font-semibold text-sm text-foreground leading-tight truncate">{lead.nome}</p>
      {lead.faturamento_mensal && (
        <p className="text-xs text-muted-foreground truncate">{lead.faturamento_mensal}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.mql && <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">MQL</Badge>}
        {lead.sql_flag && <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">SQL</Badge>}
        {proximo && (
          <span className="text-[10px] text-muted-foreground ml-auto">📅 {proximo}</span>
        )}
      </div>
      {!!lead.oportunidade && (
        <p className="text-xs font-medium text-foreground">{formatCurrency(lead.oportunidade)}</p>
      )}
    </Card>
  );
}

function KanbanColumn({ stage, leads }: { stage: typeof COLUMN_ORDER[number]; leads: Lead[] }) {
  const total = leads.length;
  const somaOp = leads.reduce((s, l) => s + (Number(l.oportunidade) || 0), 0);

  return (
    <div className="flex flex-col w-64 min-w-[16rem] shrink-0">
      <div className={`rounded-t-lg px-3 py-2 ${getHeaderStyle(stage.value)}`}>
        <p className="font-semibold text-sm leading-tight">{stage.label}</p>
        <p className="text-xs mt-0.5 opacity-90">{total} lead{total !== 1 ? 's' : ''} · {formatCurrency(somaOp)}</p>
      </div>
      <div className="flex-1 bg-muted/40 rounded-b-lg p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-13rem)]">
        {leads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
        {total === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum lead</p>}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*');
      if (error) throw error;
      return data as Lead[];
    },
  });

  const grouped = COLUMN_ORDER.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.value] = leads.filter(l => l.status === col.value);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Pipeline</h2>
        <p className="text-muted-foreground mt-1">Visualização kanban do funil de vendas.</p>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-64 min-w-[16rem] shrink-0 h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-4 pr-4">
            {COLUMN_ORDER.map(stage => (
              <KanbanColumn key={stage.value} stage={stage} leads={grouped[stage.value]} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
