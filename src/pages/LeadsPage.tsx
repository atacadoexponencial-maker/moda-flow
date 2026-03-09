import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronsUpDown, Check, X as XIcon } from 'lucide-react';
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
    ? <Check className="h-4 w-4 text-emerald-500" />
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
    const set = new Set<string>();
    allLeads.forEach(l => { if (l.faturamento_mensal) set.add(l.faturamento_mensal); });
    return Array.from(set).sort();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Leads</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} leads encontrados</p>
        </div>
        <NewLeadDialog />
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
