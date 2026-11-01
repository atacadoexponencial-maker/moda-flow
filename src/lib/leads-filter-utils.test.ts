import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { applyLeadFilters, useLeadsFilterOptions, applyAssigneeFilter, ASSIGNEE_ALL, ASSIGNEE_ME, ASSIGNEE_NONE } from "@/lib/leads-filter-utils";
import { EMPTY_FILTERS } from "@/components/leads/LeadsFilters";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "1",
    nome: "Fulano",
    email: null,
    whatsapp: null,
    status: "leads_entrada",
    mql: false,
    sql_flag: false,
    utm_source: null,
    faturamento_mensal: null,
    produto: null,
    funil: null,
    data_criada: null,
    created_at: "2026-06-10T12:00:00Z",
    ...overrides,
  } as unknown as Lead;
}

describe("applyLeadFilters", () => {
  const leads = [
    makeLead({ id: "1", nome: "Ana", status: "reuniao", mql: true, utm_source: "facebook", funil: "vendas" }),
    makeLead({ id: "2", nome: "Bruno", status: "leads_entrada", mql: false, utm_source: "google", funil: "vendas" }),
    makeLead({ id: "3", nome: "Carla", email: "carla@x.com", status: "reuniao", sql_flag: true, utm_source: "facebook", funil: "suporte" }),
  ];

  it("retorna todos os leads com filtros vazios", () => {
    expect(applyLeadFilters(leads, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("filtra por busca em nome e email (case-insensitive)", () => {
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, search: "ana" }).map(l => l.id)).toEqual(["1"]);
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, search: "carla@x" }).map(l => l.id)).toEqual(["3"]);
  });

  it("filtra por status", () => {
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, status: "reuniao" }).map(l => l.id)).toEqual(["1", "3"]);
  });

  it("filtra por mql true/false", () => {
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, mql: "true" }).map(l => l.id)).toEqual(["1"]);
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, mql: "false" }).map(l => l.id)).toEqual(["2", "3"]);
  });

  it("filtra por utmSource", () => {
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, utmSource: "facebook" }).map(l => l.id)).toEqual(["1", "3"]);
  });

  it("filtra por funil", () => {
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, funil: "suporte" }).map(l => l.id)).toEqual(["3"]);
  });

  it("combina múltiplos filtros (AND)", () => {
    const res = applyLeadFilters(leads, { ...EMPTY_FILTERS, status: "reuniao", utmSource: "facebook", funil: "suporte" });
    expect(res.map(l => l.id)).toEqual(["3"]);
  });

  it("filtra por intervalo de datas usando data_criada", () => {
    const dated = [
      makeLead({ id: "a", data_criada: "2026-06-01" }),
      makeLead({ id: "b", data_criada: "2026-06-15" }),
      makeLead({ id: "c", data_criada: "2026-06-30" }),
    ];
    const res = applyLeadFilters(dated, {
      ...EMPTY_FILTERS,
      dateFrom: new Date("2026-06-10"),
      dateTo: new Date("2026-06-20"),
    });
    expect(res.map(l => l.id)).toEqual(["b"]);
  });
});

describe("useLeadsFilterOptions", () => {
  it("retorna utm sources distintos e ordenados", () => {
    const leads = [
      makeLead({ utm_source: "google" }),
      makeLead({ utm_source: "facebook" }),
      makeLead({ utm_source: "google" }),
    ];
    const { result } = renderHook(() => useLeadsFilterOptions(leads));
    expect(result.current.utmSources).toEqual(["facebook", "google"]);
  });

  it("ordena faturamento pela ordem de negócio, não alfabética", () => {
    const leads = [
      makeLead({ faturamento_mensal: "Mais de 500 Mil" }),
      makeLead({ faturamento_mensal: "Menos de 20 Mil" }),
      makeLead({ faturamento_mensal: "De 30 a 40 Mil" }),
    ];
    const { result } = renderHook(() => useLeadsFilterOptions(leads));
    expect(result.current.faturamentos).toEqual([
      "Menos de 20 Mil",
      "De 30 a 40 Mil",
      "Mais de 500 Mil",
    ]);
  });
});

describe("filtro por responsável", () => {
  const me = "u-me";
  const other = "u-other";
  const leads = [
    makeLead({ id: "a", nome: "Meu 1", assigned_to: me }),
    makeLead({ id: "b", nome: "Meu 2", assigned_to: me }),
    makeLead({ id: "c", nome: "Dela", assigned_to: other }),
    makeLead({ id: "d", nome: "Ninguém", assigned_to: null }),
  ];

  it("CA-S1-09: 'Meus leads' no Pipeline e na tabela mostra só os leads do usuário logado", () => {
    const ids = applyLeadFilters(leads, { ...EMPTY_FILTERS, assignedTo: ASSIGNEE_ME }, { currentUserId: me }).map(l => l.id);
    expect(ids).toEqual(["a", "b"]);
    // sem usuário logado, "meus" não mostra nada
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, assignedTo: ASSIGNEE_ME }, {})).toHaveLength(0);
    // combina com os demais filtros
    const comb = applyLeadFilters(leads, { ...EMPTY_FILTERS, assignedTo: ASSIGNEE_ME, search: "meu 2" }, { currentUserId: me });
    expect(comb.map(l => l.id)).toEqual(["b"]);
  });

  it("CA-S1-10: filtrar por outra pessoa ou por 'sem responsável' mostra só os correspondentes", () => {
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, assignedTo: other }, { currentUserId: me }).map(l => l.id)).toEqual(["c"]);
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, assignedTo: ASSIGNEE_NONE }, { currentUserId: me }).map(l => l.id)).toEqual(["d"]);
    expect(applyLeadFilters(leads, { ...EMPTY_FILTERS, assignedTo: ASSIGNEE_ALL }, { currentUserId: me })).toHaveLength(4);
    expect(applyLeadFilters(leads, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("CA-S1-11: em Hoje, 'Meus' restringe atrasados, para hoje e reuniões aos leads do usuário; 'Todos' devolve tudo", () => {
    const todayStr = "2026-11-01";
    const hoje = [
      makeLead({ id: "o1", assigned_to: me, data_proximo_contato: "2026-10-20" }),
      makeLead({ id: "o2", assigned_to: other, data_proximo_contato: "2026-10-25" }),
      makeLead({ id: "t1", assigned_to: me, data_proximo_contato: todayStr }),
      makeLead({ id: "t2", assigned_to: null, data_proximo_contato: todayStr }),
      makeLead({ id: "r1", assigned_to: other, data_ra: todayStr, ra_flag: true }),
      makeLead({ id: "r2", assigned_to: me, data_ra: todayStr, ra_flag: true }),
    ];
    const split = (list: typeof hoje) => ({
      overdue: list.filter(l => l.data_proximo_contato && l.data_proximo_contato < todayStr).map(l => l.id),
      forToday: list.filter(l => l.data_proximo_contato === todayStr).map(l => l.id),
      meetings: list.filter(l => l.data_ra === todayStr && l.ra_flag).map(l => l.id),
    });
    expect(split(applyAssigneeFilter(hoje, ASSIGNEE_ME, me))).toEqual({ overdue: ["o1"], forToday: ["t1"], meetings: ["r2"] });
    expect(split(applyAssigneeFilter(hoje, ASSIGNEE_ALL, me))).toEqual({
      overdue: ["o1", "o2"], forToday: ["t1", "t2"], meetings: ["r1", "r2"],
    });
  });
});
