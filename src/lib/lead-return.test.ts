import { describe, it, expect } from "vitest";
import { hasRecentReturn, recentReturns, returnCutoffIso, RETURN_HIGHLIGHT_DAYS } from "./lead-return";

const now = new Date("2026-11-08T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

describe("destaque de lead que voltou", () => {
  it("CA-S1-25: o selo 'Voltou' aparece por 7 dias a partir do retorno e some depois", () => {
    expect(RETURN_HIGHLIGHT_DAYS).toBe(7);
    expect(hasRecentReturn({ last_return_at: daysAgo(0) }, now)).toBe(true);
    expect(hasRecentReturn({ last_return_at: daysAgo(6.9) }, now)).toBe(true);
    expect(hasRecentReturn({ last_return_at: daysAgo(7) }, now)).toBe(false);
    expect(hasRecentReturn({ last_return_at: daysAgo(30) }, now)).toBe(false);
    expect(hasRecentReturn({ last_return_at: null }, now)).toBe(false);
    expect(hasRecentReturn({ last_return_at: "data inválida" }, now)).toBe(false);
  });

  it("CA-S1-25: a seção 'Voltaram' de Hoje lista só quem voltou no período, mais recente primeiro", () => {
    const list = recentReturns(
      [
        { id: "a", last_return_at: daysAgo(3) },
        { id: "b", last_return_at: daysAgo(10) },
        { id: "c", last_return_at: daysAgo(1) },
        { id: "d", last_return_at: null },
      ],
      now,
    );
    expect(list.map((l) => l.id)).toEqual(["c", "a"]);
    expect(returnCutoffIso(now)).toBe(daysAgo(7));
  });
});
