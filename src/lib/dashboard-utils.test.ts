import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startOfDay } from "date-fns";
import { getLeadDate, isInRange, getPeriodRange, aggregateTouchesByFunnel } from "@/lib/dashboard-utils";

describe("getLeadDate", () => {
  it("prioriza data_criada sobre created_at", () => {
    const d = getLeadDate({ data_criada: "2026-01-10", created_at: "2026-02-20T12:00:00Z" });
    expect(d).toEqual(startOfDay(new Date("2026-01-10")));
  });

  it("usa created_at quando data_criada é null", () => {
    const d = getLeadDate({ data_criada: null, created_at: "2026-02-20T08:00:00Z" });
    expect(d).toEqual(startOfDay(new Date("2026-02-20T08:00:00Z")));
  });

  it("usa created_at quando data_criada é string vazia", () => {
    const d = getLeadDate({ data_criada: "", created_at: "2026-03-05T08:00:00Z" });
    expect(d).toEqual(startOfDay(new Date("2026-03-05T08:00:00Z")));
  });
});

describe("isInRange", () => {
  const range = { from: new Date("2026-06-01T10:00:00"), to: new Date("2026-06-30T23:59:59") };

  it("inclui uma data dentro do intervalo", () => {
    expect(isInRange(new Date("2026-06-15T00:00:00"), range)).toBe(true);
  });

  it("inclui o dia inicial mesmo antes do horário de 'from' (usa startOfDay)", () => {
    expect(isInRange(new Date("2026-06-01T00:00:00"), range)).toBe(true);
  });

  it("exclui uma data após o intervalo", () => {
    expect(isInRange(new Date("2026-07-01T00:00:00"), range)).toBe(false);
  });

  it("exclui uma data antes do intervalo", () => {
    expect(isInRange(new Date("2026-05-31T23:00:00"), range)).toBe(false);
  });
});

describe("getPeriodRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T15:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Datas construídas com new Date(ano, mês, dia) para serem locais (independentes de fuso)
  it("7d: o início é 6 dias antes de hoje (intervalo inclusivo de 7 dias)", () => {
    const { current, previous } = getPeriodRange("7d");
    expect(current.from).toEqual(startOfDay(new Date(2026, 5, 13)));
    expect(previous.from).toEqual(startOfDay(new Date(2026, 5, 6)));
  });

  it("30d: o início é 29 dias antes de hoje", () => {
    const { current } = getPeriodRange("30d");
    expect(current.from).toEqual(startOfDay(new Date(2026, 4, 21)));
  });

  it("month: começa no primeiro dia do mês atual e o anterior no mês passado", () => {
    const { current, previous } = getPeriodRange("month");
    expect(current.from).toEqual(startOfDay(new Date(2026, 5, 1)));
    expect(previous.from).toEqual(startOfDay(new Date(2026, 4, 1)));
  });
});

describe("aggregateTouchesByFunnel", () => {
  const range = { from: new Date("2026-06-01T00:00:00"), to: new Date("2026-06-30T23:59:59") };

  it("separa aquisições (novos) de retornos por funil", () => {
    const touches = [
      { funil: "webinar", is_aquisicao: true, created_at: "2026-06-10T10:00:00" },
      { funil: "webinar", is_aquisicao: false, created_at: "2026-06-12T10:00:00" },
      { funil: "sessao", is_aquisicao: true, created_at: "2026-06-15T10:00:00" },
    ];
    const { porFunil, totais } = aggregateTouchesByFunnel(touches, range);
    expect(totais).toEqual({ novos: 2, retornos: 1, total: 3 });
    const webinar = porFunil.find((f) => f.funil === "webinar");
    expect(webinar).toEqual({ funil: "webinar", novos: 1, retornos: 1, total: 2 });
    const sessao = porFunil.find((f) => f.funil === "sessao");
    expect(sessao).toEqual({ funil: "sessao", novos: 1, retornos: 0, total: 1 });
  });

  it("ignora touches fora do período", () => {
    const touches = [
      { funil: "webinar", is_aquisicao: true, created_at: "2026-05-30T10:00:00" },
      { funil: "webinar", is_aquisicao: true, created_at: "2026-07-02T10:00:00" },
      { funil: "webinar", is_aquisicao: true, created_at: "2026-06-15T10:00:00" },
    ];
    const { totais } = aggregateTouchesByFunnel(touches, range);
    expect(totais.total).toBe(1);
  });

  it("agrupa funil nulo como '(sem funil)'", () => {
    const touches = [{ funil: null, is_aquisicao: true, created_at: "2026-06-10T10:00:00" }];
    const { porFunil } = aggregateTouchesByFunnel(touches, range);
    expect(porFunil[0].funil).toBe("(sem funil)");
  });

  it("ordena por total decrescente", () => {
    const touches = [
      { funil: "a", is_aquisicao: true, created_at: "2026-06-10T10:00:00" },
      { funil: "b", is_aquisicao: true, created_at: "2026-06-10T10:00:00" },
      { funil: "b", is_aquisicao: false, created_at: "2026-06-11T10:00:00" },
    ];
    const { porFunil } = aggregateTouchesByFunnel(touches, range);
    expect(porFunil.map((f) => f.funil)).toEqual(["b", "a"]);
  });

  it("retorna vazio quando não há touches", () => {
    const { porFunil, totais } = aggregateTouchesByFunnel([], range);
    expect(porFunil).toEqual([]);
    expect(totais).toEqual({ novos: 0, retornos: 0, total: 0 });
  });
});
