import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronsUpDown, Check, X as XIcon, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStageLabel } from '@/lib/constants';
import { LeadDetailPanel } from '@/components/pipeline/LeadDetailPanel';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import { LeadsFilters, type LeadsFilterState } from '@/components/leads/LeadsFilters';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;
type SortKey = 'nome' | 'entrada' | 'status' | 'faturamento_mensal' | 'oportunidade' | 'data_proximo_contato' | 'mql' | 'sql_flag' | 'utm_source';
type SortDir = 'asc' | 'desc';

const PER_PAGE = 20;

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

export default function LeadsPage() {
  const [filters, setFilters] = useState<LeadsFilterState>({
    search: '', status: 'all', mql: 'all', sql: 'all',
    utmSource: 'all', faturamento: 'all', dateFrom: undefined, dateTo: undefined,
  });
  const [sortKey, setSortKey] = useState<SortKey>('entrada');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads-table'],
    queryFn: async () => {
      // Fetch all leads (handle >1000 rows)
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

  // Unique values for filter dropdowns
  const utmSources = useMemo(() => {
    const set = new Set<string>();
    allLeads.forEach(l => { if (l.utm_source) set.add(l.utm_source); });
    return Array.from(set).sort();
  }, [allLeads]);

  const faturamentos = useMemo(() => {
    const order = [
      'Menos de 20 Mil', 'De 20 a 30 Mil', 'De 30 a 40 Mil', 'De 40 a 75 Mil',
      'De 75 a 100 Mil', 'De 100 a 150 Mil', 'De 150 a 200 Mil', 'De 200 a 300 Mil',
      'De 300 a 500 Mil', 'Mais de 500 Mil',
    ];
    const set = new Set<string>();
    allLeads.forEach(l => { if (l.faturamento_mensal) set.add(l.faturamento_mensal); });
    return Array.from(set).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [allLeads]);

  // Filter
  const filtered = useMemo(() => {
    return allLeads.filter(lead => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches = [lead.nome, lead.email, lead.whatsapp].some(f => f?.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (filters.status !== 'all' && lead.status !== filters.status) return false;
      if (filters.mql === 'true' && !lead.mql) return false;
      if (filters.mql === 'false' && lead.mql) return false;
      if (filters.sql === 'true' && !lead.sql_flag) return false;
      if (filters.sql === 'false' && lead.sql_flag) return false;
      if (filters.utmSource !== 'all' && lead.utm_source !== filters.utmSource) return false;
      if (filters.faturamento !== 'all' && lead.faturamento_mensal !== filters.faturamento) return false;
      if (filters.dateFrom || filters.dateTo) {
        const entrada = getEntrada(lead);
        if (!entrada) return false;
        if (filters.dateFrom && entrada < format(filters.dateFrom, 'yyyy-MM-dd')) return false;
        if (filters.dateTo && entrada > format(filters.dateTo, 'yyyy-MM-dd')) return false;
      }
      return true;
    });
  }, [allLeads, filters]);

  // Sort
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

  // Paginate
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Leads</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} leads encontrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={sorted.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <NewLeadDialog />
        </div>
      </div>

      <LeadsFilters filters={filters} onChange={f => { setFilters(f); setPage(0); }} utmSources={utmSources} faturamentos={faturamentos} />

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
                <TableCell className="font-medium max-w-[200px] truncate">{lead.nome}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(getEntrada(lead))}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px] whitespace-nowrap">{getStageLabel(lead.status)}</Badge></TableCell>
                <TableCell className="text-xs">{lead.faturamento_mensal ?? '—'}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatCurrency(lead.oportunidade)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(lead.data_proximo_contato)}</TableCell>
                <TableCell className="text-center"><BoolIcon val={lead.mql} /></TableCell>
                <TableCell className="text-center"><BoolIcon val={lead.sql_flag} /></TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">{lead.utm_source ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
