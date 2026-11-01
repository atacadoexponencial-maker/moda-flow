// Visões salvas de filtros (Pipeline e Leads): serialização dos filtros,
// visões prontas e memória da última visão usada. A persistência das visões
// próprias é a tabela saved_views (RLS por usuário); a última visão usada é
// uma conveniência por navegador (localStorage).
import { format } from 'date-fns';
import { EMPTY_FILTERS, type LeadsFilterState } from '@/components/leads/LeadsFilters';
import { ASSIGNEE_ME } from '@/lib/leads-filter-utils';

export type ViewPage = 'pipeline' | 'leads';

export interface SavedView {
  id: string;
  name: string;
  filters: LeadsFilterState;
  builtIn: boolean;
}

export const BUILTIN_PREFIX = 'builtin:';

export function isBuiltInView(id: string | null | undefined): boolean {
  return !!id && id.startsWith(BUILTIN_PREFIX);
}

/** Filtros → JSON (datas em yyyy-MM-dd). */
export function serializeFilters(f: LeadsFilterState): Record<string, unknown> {
  return {
    ...f,
    dateFrom: f.dateFrom ? format(f.dateFrom, 'yyyy-MM-dd') : null,
    dateTo: f.dateTo ? format(f.dateTo, 'yyyy-MM-dd') : null,
  };
}

/** JSON → filtros, completando chaves novas com o padrão para visões antigas continuarem válidas. */
export function deserializeFilters(raw: unknown): LeadsFilterState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: LeadsFilterState = { ...EMPTY_FILTERS };
  for (const key of Object.keys(EMPTY_FILTERS) as (keyof LeadsFilterState)[]) {
    if (key === 'dateFrom' || key === 'dateTo') {
      const v = src[key];
      out[key] = typeof v === 'string' && v ? new Date(`${v}T00:00:00`) : undefined;
    } else if (typeof src[key] === 'string') {
      (out as unknown as Record<string, string>)[key] = src[key] as string;
    }
  }
  return out;
}

/** Visões prontas, iguais para todos: Leads Hoje, Meus leads e uma por funil existente. */
export function builtInViews(funis: string[], today: Date = new Date()): SavedView[] {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const views: SavedView[] = [
    { id: `${BUILTIN_PREFIX}hoje`, name: 'Leads Hoje', builtIn: true, filters: { ...EMPTY_FILTERS, dateFrom: day, dateTo: day } },
    { id: `${BUILTIN_PREFIX}meus`, name: 'Meus leads', builtIn: true, filters: { ...EMPTY_FILTERS, assignedTo: ASSIGNEE_ME } },
  ];
  for (const f of [...new Set(funis.filter(Boolean))].sort()) {
    views.push({ id: `${BUILTIN_PREFIX}funil:${f}`, name: `Funil: ${f}`, builtIn: true, filters: { ...EMPTY_FILTERS, funil: f } });
  }
  return views;
}

/** Chave da última visão usada por usuário e página. */
export function lastViewKey(userId: string, page: ViewPage): string {
  return `moda-flow:last-view:${userId}:${page}`;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function rememberLastView(store: KeyValueStore, key: string, viewId: string | null): void {
  try {
    if (viewId) store.setItem(key, viewId);
    else store.removeItem(key);
  } catch {
    /* armazenamento indisponível: sem memória, sem erro */
  }
}

export function readLastView(store: KeyValueStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

/** Nome válido para salvar: não vazio, até 60 caracteres. */
export function normalizeViewName(name: string): string | null {
  const t = name.trim();
  return t.length > 0 && t.length <= 60 ? t : null;
}
