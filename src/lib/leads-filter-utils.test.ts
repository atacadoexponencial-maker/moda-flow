import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { applyLeadFilters, useLeadsFilterOptions } from "@/lib/leads-filter-utils";
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
