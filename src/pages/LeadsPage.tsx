import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronUp, ChevronDown, ChevronsUpDown, Check, X as XIcon, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStageLabel } from '@/lib/constants';
import { LeadDetailPanel } from '@/components/pipeline/LeadDetailPanel';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import { LeadsFilters, EMPTY_FILTERS, type LeadsFilterState } from '@/components/leads/LeadsFilters';
import { useLeadsFilterOptions, applyLeadFilters } from '@/lib/leads-filter-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;
type SortKey = 'nome' | 'entrada' | 'status' | 'faturamento_mensal' | 'oportunidade' | 'data_proximo_contato' | 'mql' | 'sql_flag' | 'utm_source';
type SortDir = 'asc' | 'desc';

const PER_PAGE = 20;

const FATURAMENTO_OPTIONS = [
  'Menos de 20 Mil',
  'De 20 a 30 Mil',
  'De 30 a 40 Mil',
  'De 40 a 75 Mil',
  'De 75 a 100 Mil',
  'De 100 a 150 Mil',
  'De 150 a 200 Mil',
  'De 200 a 300 Mil',
  'De 300 a 500 Mil',
  'Mais de 500 Mil',
];

function getEntrada(lead: Lead): string {
  return (lead as any).data_criada ?? lead.created_at?.slice(0, 10) ?? '';
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
}

function formatCurrency(v: number | null) {
  if (!v) return 'R$ 0';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function BoolIcon({ val }: { val: boolean | null }) {
  return val
    ? <Check className="h-4 w-4 text-accent-foreground" />
    : <XIcon className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

/* ── Editable Cell ── */
type EditableField = 'nome' | 'faturamento_mensal' | 'oportunidade' | 'status';

function EditableCell({
  value,
  leadId,
  field,
  onSave,
}: {
  value: string | number | null;
  leadId: string;
  field: EditableField;
  onSave: (leadId: string, field: EditableField, newValue: string | number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value ?? ''));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = async () => {
    let newValue: string | number | null;
    if (field === 'oportunidade') {
      newValue = draft ? Number(draft) : 0;
    } else {
      newValue = draft.trim() || null;
    }
    // Skip save if unchanged
    const oldVal = field === 'oportunidade' ? (value ?? 0) : (value ?? null);
    if (newValue === oldVal || String(newValue) === String(oldVal)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(leadId, field, newValue);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value ?? ''));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  if (editing) {
    const cls = `w-full h-7 px-1.5 text-xs rounded border bg-background outline-none focus:ring-1 focus:ring-ring ${saving ? 'cursor-wait border-primary' : 'border-input'}`;

    if (field === 'faturamento_mensal' || field === 'status') {
      const options = field === 'faturamento_mensal' ? FATURAMENTO_OPTIONS : FUNNEL_STAGES.map(s => s.value);
      const getLabel = (v: string) => field === 'status' ? getStageLabel(v) : v;
      return (
        <div onClick={e => e.stopPropagation()}>
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            className={cls}
            value={draft}
            onChange={e => { setDraft(e.target.value); }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={saving}
          >
            {field === 'faturamento_mensal' && <option value="">—</option>}
            {options.map(opt => (
              <option key={opt} value={opt}>{getLabel(opt)}</option>
            ))}
            ))}
          </select>
        </div>
      );
    }

    return (
      <div onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className={cls}
          type={field === 'oportunidade' ? 'number' : 'text'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          disabled={saving}
        />
      </div>
    );
  }

  // Display mode
  let display: React.ReactNode;
  if (field === 'oportunidade') {
    display = formatCurrency(typeof value === 'number' ? value : null);
  } else if (field === 'faturamento_mensal') {
    display = (value as string) ?? '—';
  } else {
    display = (value as string) ?? '—';
  }

  return (
    <span
      className="cursor-text hover:bg-muted/60 rounded px-1 -mx-1 transition-colors"
      onClick={startEdit}
      title="Clique para editar"
    >
      {display}
    </span>
  );
}

/* ── Mobile Lead Card ── */
function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <Card className="p-3 space-y-2 cursor-pointer active:bg-muted/50" onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm text-foreground truncate">{lead.nome}</p>
        <Badge variant="secondary" className="text-[10px] whitespace-nowrap shrink-0">{getStageLabel(lead.status)}</Badge>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {lead.faturamento_mensal && <span>{lead.faturamento_mensal}</span>}
        <span>{formatCurrency(lead.oportunidade)}</span>
        <span className="ml-auto">{formatDate(getEntrada(lead))}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {lead.mql && <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">MQL</Badge>}
        {lead.sql_flag && <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">SQL</Badge>}
        {lead.utm_source && <span className="text-[10px] text-muted-foreground ml-auto">{lead.utm_source}</span>}
      </div>
    </Card>
  );
}

export default function LeadsPage() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<LeadsFilterState>({ ...EMPTY_FILTERS });
  const [sortKey, setSortKey] = useState<SortKey>('entrada');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads-table'],
    queryFn: async () => {
      let all: Lead[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('leads').select('*').range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return all;
    },
  });

  const { utmSources, faturamentos, produtos, funis } = useLeadsFilterOptions(allLeads);

  const filtered = useMemo(() => applyLeadFilters(allLeads, filters), [allLeads, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number | boolean | null = null;
      let bv: string | number | boolean | null = null;
      switch (sortKey) {
        case 'nome': av = a.nome.toLowerCase(); bv = b.nome.toLowerCase(); break;
        case 'entrada': av = getEntrada(a); bv = getEntrada(b); break;
        case 'status': av = a.status; bv = b.status; break;
        case 'faturamento_mensal': av = a.faturamento_mensal ?? ''; bv = b.faturamento_mensal ?? ''; break;
        case 'oportunidade': av = a.oportunidade ?? 0; bv = b.oportunidade ?? 0; break;
        case 'data_proximo_contato': av = a.data_proximo_contato ?? ''; bv = b.data_proximo_contato ?? ''; break;
        case 'mql': av = a.mql ? 1 : 0; bv = b.mql ? 1 : 0; break;
        case 'sql_flag': av = a.sql_flag ? 1 : 0; bv = b.sql_flag ? 1 : 0; break;
        case 'utm_source': av = a.utm_source ?? ''; bv = b.utm_source ?? ''; break;
      }
      if (av === bv) return 0;
      if (av === null || av === '') return 1;
      if (bv === null || bv === '') return -1;
      const cmp = av < bv ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const handleInlineSave = async (leadId: string, field: EditableField, newValue: string | number | null) => {
    const { error } = await supabase.from('leads').update({ [field]: newValue }).eq('id', leadId);
    if (error) return;
    queryClient.setQueryData<Lead[]>(['leads-table'], old =>
      old?.map(l => l.id === leadId ? { ...l, [field]: newValue } : l) ?? []
    );
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const SortableHead = ({ col, children, className }: { col: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => toggleSort(col)} className="inline-flex items-center hover:text-foreground transition-colors">
        {children}
        <SortIcon col={col} />
      </button>
    </TableHead>
  );

  const exportCSV = () => {
    const fmtDate = (d: string | null) => {
      if (!d) return '';
      try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return ''; }
    };
    const fmtMoney = (v: number | null) => v != null ? v.toFixed(2).replace('.', ',') : '0,00';
    const bool = (v: boolean | null) => v ? 'Sim' : 'Não';
    const esc = (v: string | null | undefined) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ['Nome','E-mail','WhatsApp','Instagram','Status','Funil','Produto','Faturamento Mensal','Oportunidade','Arrecadado','MQL','SQL','RA','RR','Data de Entrada','Último Contato','Próximo Contato','RA (data)','Justificativa','Objetivo','Motivo de Perda','utm_source','utm_medium','utm_content','utm_campaign','utm_posicion'];
    const rows = sorted.map(l => [
      esc(l.nome), esc(l.email), esc(l.whatsapp), esc(l.instagram),
      esc(getStageLabel(l.status)), esc(l.funil), esc(l.produto), esc(l.faturamento_mensal),
      fmtMoney(l.oportunidade), fmtMoney(l.arrecadado),
      bool(l.mql), bool(l.sql_flag), bool(l.ra_flag), bool(l.rr_flag),
      fmtDate(getEntrada(l)), fmtDate(l.data_ultimo_contato), fmtDate(l.data_proximo_contato), fmtDate(l.data_ra),
      esc(l.justificativa), esc(l.objetivo), esc(l.loss_reason),
      esc(l.utm_source), esc(l.utm_medium), esc(l.utm_content), esc(l.utm_campaign), esc(l.utm_posicion),
    ].join(','));

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_exportados_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Leads</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} leads encontrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size={isMobile ? 'sm' : 'default'} onClick={exportCSV} disabled={sorted.length === 0}>
            <Download className="h-4 w-4 mr-1 md:mr-2" />
            {!isMobile && 'Exportar CSV'}
          </Button>
          <NewLeadDialog />
        </div>
      </div>

      <LeadsFilters
        filters={filters}
        onChange={f => { setFilters(f); setPage(0); }}
        utmSources={utmSources}
        faturamentos={faturamentos}
        produtos={produtos}
        funis={funis}
      />

      {/* ── MOBILE: Stacked cards ── */}
      {isMobile ? (
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))
          ) : paginated.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</p>
          ) : (
            paginated.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
            ))
          )}
        </div>
      ) : (
        /* ── DESKTOP: Table ── */
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead col="nome">Nome</SortableHead>
                <SortableHead col="entrada">Entrada</SortableHead>
                <SortableHead col="status">Status</SortableHead>
                <SortableHead col="faturamento_mensal">Faturamento</SortableHead>
                <SortableHead col="oportunidade">Oportunidade</SortableHead>
                <SortableHead col="data_proximo_contato">Próx. Contato</SortableHead>
                <SortableHead col="mql" className="text-center">MQL</SortableHead>
                <SortableHead col="sql_flag" className="text-center">SQL</SortableHead>
                <SortableHead col="utm_source">Fonte</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
              ) : paginated.map(lead => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                  <TableCell className="font-medium max-w-[200px]">
                    <EditableCell value={lead.nome} leadId={lead.id} field="nome" onSave={handleInlineSave} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(getEntrada(lead))}</TableCell>
                  <TableCell>
                    <EditableCell value={lead.status} leadId={lead.id} field="status" onSave={handleInlineSave} />
                  </TableCell>
                  <TableCell className="text-xs">
                    <EditableCell value={lead.faturamento_mensal} leadId={lead.id} field="faturamento_mensal" onSave={handleInlineSave} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <EditableCell value={lead.oportunidade} leadId={lead.id} field="oportunidade" onSave={handleInlineSave} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(lead.data_proximo_contato)}</TableCell>
                  <TableCell className="text-center"><BoolIcon val={lead.mql} /></TableCell>
                  <TableCell className="text-center"><BoolIcon val={lead.sql_flag} /></TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{lead.utm_source ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      <LeadDetailPanel lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
