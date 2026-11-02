// Regras da caixa de entrada "Conversas" (S2-06). O filtro por responsável é o
// mesmo do Pipeline (applyAssigneeFilter).
import { applyAssigneeFilter, ASSIGNEE_ALL } from "@/lib/leads-filter-utils";

export interface InboxLead {
  id: string;
  nome: string;
  whatsapp: string | null;
  status: string;
  assigned_to: string | null;
}

export interface InboxItem {
  id: string;
  lead_id: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_direction: "recebida" | "enviada" | null;
  last_inbound_at: string | null;
  lead: InboxLead;
}

export interface InboxFilters {
  /** 'all' | 'me' | 'none' | user_id — mesma semântica do filtro de responsável. */
  scope: string;
  unansweredOnly: boolean;
  search: string;
}

export const EMPTY_INBOX_FILTERS: InboxFilters = { scope: ASSIGNEE_ALL, unansweredOnly: false, search: "" };

/** Mais recente primeiro; conversas sem mensagem ficam por último. */
export function sortInbox<T extends { last_message_at: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
}

export function totalUnread(list: Array<{ unread_count: number }>): number {
  return list.reduce((s, c) => s + (c.unread_count > 0 ? c.unread_count : 0), 0);
}

/** "Não respondida": a última mensagem da conversa é do lead. */
export function isUnanswered(c: { last_message_direction: string | null }): boolean {
  return c.last_message_direction === "recebida";
}

export function filterInbox(list: InboxItem[], f: InboxFilters, currentUserId?: string | null): InboxItem[] {
  const q = f.search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const byScope = applyAssigneeFilter(
    list.map((c) => ({ ...c, assigned_to: c.lead.assigned_to })),
    f.scope,
    currentUserId,
  );
  return sortInbox(
    byScope.filter((c) => {
      if (f.unansweredOnly && !isUnanswered(c)) return false;
      if (q) {
        const nameHit = c.lead.nome.toLowerCase().includes(q);
        const phoneHit = digits.length >= 3 && (c.lead.whatsapp ?? "").replace(/\D/g, "").includes(digits);
        if (!nameHit && !phoneHit) return false;
      }
      return true;
    }),
  );
}

/** Aplica uma mudança de conversa vinda do tempo real, mantendo os dados do lead. */
export function applyConversationChange(list: InboxItem[], change: Partial<InboxItem> & { id: string; lead_id: string }): { list: InboxItem[]; known: boolean } {
  const i = list.findIndex((c) => c.id === change.id);
  if (i === -1) return { list, known: false };
  const next = [...list];
  next[i] = { ...next[i], ...change, lead: next[i].lead };
  return { list: sortInbox(next), known: true };
}
