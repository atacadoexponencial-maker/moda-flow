import { describe, it, expect } from "vitest";
import { filterInbox, sortInbox, totalUnread, applyConversationChange, EMPTY_INBOX_FILTERS, type InboxItem } from "@/lib/whatsapp-inbox";
import { ASSIGNEE_ME, ASSIGNEE_NONE, ASSIGNEE_ALL } from "@/lib/leads-filter-utils";

const ME = "u-me";
const OTHER = "u-other";

function item(
  id: string,
  at: string | null,
  opts: Partial<InboxItem> & { assigned_to?: string | null; nome?: string; whatsapp?: string } = {},
): InboxItem {
  return {
    id,
    lead_id: `lead-${id}`,
    unread_count: opts.unread_count ?? 0,
    last_message_at: at,
    last_message_text: opts.last_message_text ?? "oi",
    last_message_direction: opts.last_message_direction ?? "recebida",
    last_inbound_at: at,
    lead: {
      id: `lead-${id}`,
      nome: opts.nome ?? `Lead ${id}`,
      whatsapp: opts.whatsapp ?? "11999990000",
      status: "leads_entrada",
      assigned_to: opts.assigned_to ?? null,
    },
  };
}

const list = [
  item("a", "2026-11-01T09:00:00Z", { unread_count: 2, assigned_to: ME }),
  item("b", "2026-11-01T12:00:00Z", { unread_count: 0, assigned_to: OTHER, last_message_direction: "enviada" }),
  item("c", "2026-11-01T11:00:00Z", { unread_count: 3, assigned_to: null, nome: "Carla Mendes", whatsapp: "(21) 98888-7777" }),
  item("d", "2026-10-31T18:00:00Z", { unread_count: 0, assigned_to: ME, last_message_direction: "enviada" }),
];

describe("caixa de entrada", () => {
  it("CA-S2-25: conversas da mais recente para a mais antiga, com não lidas e total para o menu", () => {
    expect(sortInbox(list).map((c) => c.id)).toEqual(["b", "c", "a", "d"]);
    expect(filterInbox(list, EMPTY_INBOX_FILTERS, ME).map((c) => [c.id, c.unread_count])).toEqual([["b", 0], ["c", 3], ["a", 2], ["d", 0]]);
    expect(totalUnread(list)).toBe(5);
    expect(sortInbox([item("x", null), item("y", "2026-01-01T00:00:00Z")]).map((c) => c.id)).toEqual(["y", "x"]);
  });

  it("CA-S2-26: 'Não respondidas' mostra só conversas cuja última mensagem é do lead", () => {
    expect(filterInbox(list, { ...EMPTY_INBOX_FILTERS, unansweredOnly: true }, ME).map((c) => c.id)).toEqual(["c", "a"]);
  });

  it("CA-S2-27: 'Minhas' e 'Sem responsável' seguem a regra do filtro de responsável do Pipeline", () => {
    expect(filterInbox(list, { ...EMPTY_INBOX_FILTERS, scope: ASSIGNEE_ME }, ME).map((c) => c.id)).toEqual(["a", "d"]);
    expect(filterInbox(list, { ...EMPTY_INBOX_FILTERS, scope: ASSIGNEE_NONE }, ME).map((c) => c.id)).toEqual(["c"]);
    expect(filterInbox(list, { ...EMPTY_INBOX_FILTERS, scope: ASSIGNEE_ALL }, ME)).toHaveLength(4);
    expect(filterInbox(list, { ...EMPTY_INBOX_FILTERS, scope: ASSIGNEE_ME }, null)).toHaveLength(0);
    expect(filterInbox(list, { ...EMPTY_INBOX_FILTERS, search: "carla" }, ME).map((c) => c.id)).toEqual(["c"]);
    expect(filterInbox(list, { ...EMPTY_INBOX_FILTERS, search: "98888" }, ME).map((c) => c.id)).toEqual(["c"]);
  });

  it("CA-S2-28: mensagem nova leva a conversa ao topo com a contagem atualizada, mantendo os dados do lead", () => {
    const sorted = sortInbox(list);
    const { list: next, known } = applyConversationChange(sorted, {
      id: "d", lead_id: "lead-d", unread_count: 1, last_message_at: "2026-11-01T13:00:00Z",
      last_message_text: "voltei", last_message_direction: "recebida",
    });
    expect(known).toBe(true);
    expect(next[0]).toMatchObject({ id: "d", unread_count: 1, last_message_text: "voltei", lead: { nome: "Lead d" } });
    expect(totalUnread(next)).toBe(6);
    expect(applyConversationChange(sorted, { id: "novo", lead_id: "lead-novo" }).known).toBe(false);
  });
});
