import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, SlidersHorizontal, X } from 'lucide-react';
import { format, subDays, startOfMonth, startOfWeek, endOfWeek, subMonths, startOfYear } from 'date-fns';
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
  produto: string;
  funil: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export const EMPTY_FILTERS: LeadsFilterState = {
  search: '', status: 'all', mql: 'all', sql: 'all',
  utmSource: 'all', faturamento: 'all', produto: 'all', funil: 'all',
  dateFrom: undefined, dateTo: undefined,
};

interface Props {
  filters: LeadsFilterState;
  onChange: (f: LeadsFilterState) => void;
  utmSources: string[];
  faturamentos: string[];
  produtos: string[];
  funis: string[];
}

const DATE_SHORTCUTS = [
  {
    label: 'Últimos 7 dias',
    getRange: () => {
      const today = new Date();
      return { from: subDays(today, 7), to: subDays(today, 1) };
    },
  },
  {
    label: 'Últimos 30 dias',
    getRange: () => {
      const today = new Date();
      return { from: subDays(today, 30), to: subDays(today, 1) };
    },
  },
  {
    label: 'Esta semana',
    getRange: () => {
      const today = new Date();
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: today };
    },
  },
  {
    label: 'Semana passada',
    getRange: () => {
      const today = new Date();
      const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });
      return { from: lastWeekStart, to: lastWeekEnd };
    },
  },
  {
    label: 'Este mês',
    getRange: () => {
      const today = new Date();
      return { from: startOfMonth(today), to: today };
    },
  },
  {
    label: 'Mês passado',
    getRange: () => {
      const today = new Date();
      const lastMonth = subMonths(today, 1);
      return { from: startOfMonth(lastMonth), to: subDays(startOfMonth(today), 1) };
    },
  },
  {
    label: 'Este ano',
    getRange: () => {
      const today = new Date();
      return { from: startOfYear(today), to: today };
    },
  },
];

export function LeadsFilters({ filters, onChange, utmSources, faturamentos, produtos, funis }: Props) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof LeadsFilterState>(key: K, val: LeadsFilterState[K]) =>
    onChange({ ...filters, [key]: val });

  const applyShortcut = (shortcut: typeof DATE_SHORTCUTS[number]) => {
    const { from, to } = shortcut.getRange();
    onChange({ ...filters, dateFrom: from, dateTo: to });
  };

  const activeFilterCount = [
    filters.status !== 'all',
    filters.produto !== 'all',
    filters.funil !== 'all',
    filters.utmSource !== 'all',
    filters.faturamento !== 'all',
    filters.mql !== 'all',
    filters.sql !== 'all',
    filters.dateFrom !== undefined,
    filters.dateTo !== undefined,
  ].filter(Boolean).length;

  const hasFilters = activeFilterCount > 0 || !!filters.search;

  const clearAll = () => {
    onChange({ ...EMPTY_FILTERS });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input
        placeholder="Buscar nome, email ou whatsapp…"
        value={filters.search}
        onChange={e => set('search', e.target.value)}
        className="w-64 h-9"
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-9 gap-2', activeFilterCount > 0 && 'border-primary text-primary')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge className="h-5 min-w-5 px-1 text-xs rounded-full bg-primary text-primary-foreground">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[480px] p-4" align="start">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-sm">Filtros</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3 mr-1" />Limpar tudo
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={filters.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos os Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {FUNNEL_STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Produto</label>
              <Select value={filters.produto} onValueChange={v => set('produto', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos Produtos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Produtos</SelectItem>
                  {produtos.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Funil</label>
              <Select value={filters.funil} onValueChange={v => set('funil', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos os Funis" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Funis</SelectItem>
                  {funis.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fonte (UTM)</label>
              <Select value={filters.utmSource} onValueChange={v => set('utmSource', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas as Fontes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Fontes</SelectItem>
                  {utmSources.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Faturamento</label>
              <Select value={filters.faturamento} onValueChange={v => set('faturamento', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos Faturamentos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Faturamentos</SelectItem>
                  {faturamentos.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2 col-span-1">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">MQL</label>
                <Select value={filters.mql} onValueChange={v => set('mql', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">SQL</label>
                <Select value={filters.sql} onValueChange={v => set('sql', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-xs text-muted-foreground">Data de entrada</label>
            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 flex-1 justify-start text-left text-xs font-normal', !filters.dateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy') : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filters.dateFrom} onSelect={d => set('dateFrom', d)} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 flex-1 justify-start text-left text-xs font-normal', !filters.dateTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy') : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filters.dateTo} onSelect={d => set('dateTo', d)} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-wrap gap-1">
              {DATE_SHORTCUTS.map(s => (
                <Button
                  key={s.label}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2 py-0"
                  onClick={() => applyShortcut(s)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-xs text-muted-foreground">
          <X className="h-3 w-3 mr-1" />Limpar
        </Button>
      )}
    </div>
  );
}
