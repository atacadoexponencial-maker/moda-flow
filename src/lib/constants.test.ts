import { describe, it, expect } from "vitest";
import { getStageLabel, FUNNEL_STAGES } from "@/lib/constants";

describe("getStageLabel", () => {
  it("retorna o label de um estágio conhecido", () => {
    expect(getStageLabel("contrato_assinado")).toBe("Contrato Assinado");
    expect(getStageLabel("leads_entrada")).toBe("Leads de Entrada");
  });

  it("retorna o valor cru quando o estágio é desconhecido", () => {
    expect(getStageLabel("inexistente")).toBe("inexistente");
    expect(getStageLabel("")).toBe("");
  });

  it("tem label para todos os estágios do funil", () => {
    for (const stage of FUNNEL_STAGES) {
      expect(getStageLabel(stage.value)).toBe(stage.label);
    }
  });
});
