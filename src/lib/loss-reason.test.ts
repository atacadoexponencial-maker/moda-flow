import { describe, it, expect } from "vitest";
import { LOSS_REASONS, OTHER_LOSS_REASON, resolveLossReason, lossReasonSelectValue, lossReasonOtherText } from "./loss-reason";

describe("motivo de perda padronizado", () => {
  it("CA-S1-14: a lista é exatamente os 8 motivos do ClickUp mais 'Outro', nessa ordem", () => {
    expect([...LOSS_REASONS]).toEqual([
      "Nunca respondeu abordagem",
      "Fora do perfil",
      "Não tem interesse",
      "Não é prioridade",
      "No show",
      "Não tem budget",
      "Tentativas de contato esgotadas",
      "Não tem time",
      "Outro",
    ]);
    expect(OTHER_LOSS_REASON).toBe("Outro");
  });

  it("CA-S1-13: sem motivo, ou 'Outro' sem texto, a confirmação fica bloqueada", () => {
    expect(resolveLossReason(null, "")).toBeNull();
    expect(resolveLossReason("", "qualquer")).toBeNull();
    expect(resolveLossReason("Outro", "")).toBeNull();
    expect(resolveLossReason("Outro", "   ")).toBeNull();
    expect(resolveLossReason("Motivo inventado", "")).toBeNull();
    // com motivo da lista, libera
    expect(resolveLossReason("Fora do perfil", "")).toBe("Fora do perfil");
  });

  it("CA-S1-15: 'Outro' com texto grava o texto escrito", () => {
    expect(resolveLossReason("Outro", "  Mudou de ramo ")).toBe("Mudou de ramo");
  });

  it("CA-S1-16: o painel reflete o motivo gravado e permite trocar pela lista", () => {
    // item da lista → o próprio item, sem texto "Outro"
    expect(lossReasonSelectValue("No show")).toBe("No show");
    expect(lossReasonOtherText("No show")).toBe("");
    // texto livre (motivo antigo ou "Outro" digitado) → seletor em "Outro" com o texto
    expect(lossReasonSelectValue("Sem dinheiro no momento")).toBe("Outro");
    expect(lossReasonOtherText("Sem dinheiro no momento")).toBe("Sem dinheiro no momento");
    // vazio → nada selecionado
    expect(lossReasonSelectValue(null)).toBe("");
    expect(lossReasonOtherText(null)).toBe("");
    // trocar pela lista gera o novo valor a salvar
    expect(resolveLossReason("Não tem budget", lossReasonOtherText("Sem dinheiro no momento"))).toBe("Não tem budget");
  });
});
