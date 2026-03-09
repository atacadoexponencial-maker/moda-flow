import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FUNNEL_STAGES } from '@/lib/constants';

export interface LeadsFilterState {
  search: string;
  status: string;
  mql: string;
  sql: string;
  utmSource: string;
  faturamento: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface Props {
  filters: LeadsFilterState;
  onChange: (f: LeadsFilterState) => void;
  utmSources: string[];
  faturamentos: string[];
}

export function LeadsFilters({ filters, onChange, utmSources, faturamentos }: Props) {
  const set = <K extends keyof LeadsFilterState>(key: K, val: LeadsFilterState[K]) =>
    onChange({ ...filters, [key]: val });

  const hasFilters = filters.status !== 'all' || filters.mql !== 'all' || filters.sql !== 'all'
    || filters.utmSource !== 'all' || filters.faturamento !== 'all'
    || filters.dateFrom || filters.dateTo || filters.search;

  const clearAll = () => onChange({
    search: '', status: 'all', mql: 'all', sql: 'all',
    utmSource: 'all', faturamento: 'all', dateFrom: undefined, dateTo: undefined,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <Input
          placeholder="Buscar nome, email ou whatsapp…"
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          className="w-64 h-9"
        />
        <Select value={filters.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {FUNNEL_STAGES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.mql} onValueChange={v => set('mql', v)}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="MQL" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">MQL: Todos</SelectItem>
            <SelectItem value="true">MQL: Sim</SelectItem>
            <SelectItem value="false">MQL: Não</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.sql} onValueChange={v => set('sql', v)}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="SQL" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">SQL: Todos</SelectItem>
            <SelectItem value="true">SQL: Sim</SelectItem>
            <SelectItem value="false">SQL: Não</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.utmSource} onValueChange={v => set('utmSource', v)}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Fontes</SelectItem>
            {utmSources.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.faturamento} onValueChange={v => set('faturamento', v)}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Faturamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Faturamentos</SelectItem>
            {faturamentos.map(f => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">Entrada:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-9 w-36 justify-start text-left font-normal', !filters.dateFrom && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy') : 'De'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateFrom} onSelect={d => set('dateFrom', d)} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-9 w-36 justify-start text-left font-normal', !filters.dateTo && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy') : 'Até'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateTo} onSelect={d => set('dateTo', d)} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-xs">
            <X className="h-3 w-3 mr-1" />Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
