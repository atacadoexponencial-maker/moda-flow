import { useMemo } from 'react';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import type { LeadsFilterState } from '@/components/leads/LeadsFilters';

type Lead = Tables<'leads'>;

function getEntrada(lead: Lead): string {
  return (lead as any).data_criada ?? lead.created_at?.slice(0, 10) ?? '';
}

export function useLeadsFilterOptions(leads: Lead[]) {
  const utmSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.utm_source) set.add(l.utm_source); });
    return Array.from(set).sort();
  }, [leads]);

  const faturamentos = useMemo(() => {
    const order = [
      'Menos de 20 Mil', 'De 20 a 30 Mil', 'De 30 a 40 Mil', 'De 40 a 75 Mil',
      'De 75 a 100 Mil', 'De 100 a 150 Mil', 'De 150 a 200 Mil', 'De 200 a 300 Mil',
      'De 300 a 500 Mil', 'Mais de 500 Mil',
    ];
    const set = new Set<string>();
    leads.forEach(l => { if (l.faturamento_mensal) set.add(l.faturamento_mensal); });
    return Array.from(set).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [leads]);

  const produtos = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.produto) set.add(l.produto); });
    return Array.from(set).sort();
  }, [leads]);

  const funis = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.funil) set.add(l.funil); });
    return Array.from(set).sort();
  }, [leads]);

  return { utmSources, faturamentos, produtos, funis };
}

export function applyLeadFilters(leads: Lead[], filters: LeadsFilterState): Lead[] {
  return leads.filter(lead => {
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
    if (filters.produto !== 'all' && lead.produto !== filters.produto) return false;
    if (filters.funil !== 'all' && lead.funil !== filters.funil) return false;
    if (filters.dateFrom || filters.dateTo) {
      const entrada = getEntrada(lead);
      if (!entrada) return false;
      if (filters.dateFrom && entrada < format(filters.dateFrom, 'yyyy-MM-dd')) return false;
      if (filters.dateTo && entrada > format(filters.dateTo, 'yyyy-MM-dd')) return false;
    }
    return true;
  });
}
