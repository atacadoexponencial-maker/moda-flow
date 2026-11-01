import { describe, it, expect } from "vitest";
import {
  serializeFilters,
  deserializeFilters,
  builtInViews,
  isBuiltInView,
  lastViewKey,
  rememberLastView,
  readLastView,
  normalizeViewName,
  type KeyValueStore,
} from "./saved-views";
import { EMPTY_FILTERS } from "@/components/leads/LeadsFilters";

function memStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

describe("visões salvas", () => {
  it("CA-S1-27: salvar e reabrir uma visão aplica exatamente os mesmos filtros", () => {
    const filters = {
      ...EMPTY_FILTERS,
      search: "silva",
      status: "reuniao",
      funil: "workshop",
      assignedTo: "me",
      mql: "true",
      dateFrom: new Date(2026, 9, 1),
      dateTo: new Date(2026, 9, 31),
    };
    const json = JSON.parse(JSON.stringify(serializeFilters(filters)));
    const back = deserializeFilters(json);
    expect(back).toEqual(filters);
  });

  it("CA-S1-27: visão antiga sem chaves novas abre com os padrões (não quebra)", () => {
    const back = deserializeFilters({ status: "contrato", lixo: 1 });
    expect(back).toEqual({ ...EMPTY_FILTERS, status: "contrato" });
    expect(deserializeFilters(null)).toEqual(EMPTY_FILTERS);
  });

  it("CA-S1-28: visões prontas são Leads Hoje, Meus leads e uma por funil existente", () => {
    const today = new Date(2026, 10, 1, 15, 30);
    const views = builtInViews(["workshop", "sessao-estrategica", "", "workshop"], today);
    expect(views.map((v) => v.name)).toEqual(["Leads Hoje", "Meus leads", "Funil: sessao-estrategica", "Funil: workshop"]);
    expect(views.every((v) => v.builtIn && isBuiltInView(v.id))).toBe(true);
    const hoje = views[0].filters;
    expect(hoje.dateFrom).toEqual(new Date(2026, 10, 1));
    expect(hoje.dateTo).toEqual(new Date(2026, 10, 1));
    expect(views[1].filters.assignedTo).toBe("me");
    expect(views[2].filters.funil).toBe("sessao-estrategica");
  });

  it("CA-S1-30: a última visão usada é lembrada por usuário e página e reabre depois", () => {
    const store = memStore();
    const key = lastViewKey("u1", "pipeline");
    expect(readLastView(store, key)).toBeNull();
    rememberLastView(store, key, "view-abc");
    expect(readLastView(store, key)).toBe("view-abc");
    // outra página/usuário não se misturam
    expect(readLastView(store, lastViewKey("u1", "leads"))).toBeNull();
    expect(readLastView(store, lastViewKey("u2", "pipeline"))).toBeNull();
    rememberLastView(store, key, null);
    expect(readLastView(store, key)).toBeNull();
  });

  it("CA-S1-31: visão pronta não é renomeável nem excluível; nome de visão própria é validado", () => {
    expect(isBuiltInView("builtin:hoje")).toBe(true);
    expect(isBuiltInView("8f1c…")).toBe(false);
    expect(isBuiltInView(null)).toBe(false);
    expect(normalizeViewName("  Workshop quente ")).toBe("Workshop quente");
    expect(normalizeViewName("   ")).toBeNull();
    expect(normalizeViewName("x".repeat(61))).toBeNull();
  });
});
