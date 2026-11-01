import { describe, it, expect } from "vitest";
import {
  validateAttachments,
  canSubmitActivity,
  isImageMime,
  buildAttachmentPath,
  formatBytes,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_ACTIVITY,
} from "./attachments";

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("anexos de atividade — regras", () => {
  it("CA-S1-19: arquivo acima do limite ou de tipo não aceito fica fora da seleção, com o motivo", () => {
    const { accepted, rejected } = validateAttachments(0, [
      f("print.png", "image/png"),
      f("grande.jpg", "image/jpeg", MAX_ATTACHMENT_BYTES + 1),
      f("planilha.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      f("contrato.pdf", "application/pdf"),
      f("video.mp4", "video/mp4"),
    ]);
    expect(accepted.map((a) => a.name)).toEqual(["print.png", "contrato.pdf"]);
    expect(rejected).toHaveLength(3);
    expect(rejected.find((r) => r.name === "grande.jpg")?.reason).toContain("10,0 MB");
    expect(rejected.find((r) => r.name === "planilha.xlsx")?.reason).toContain("Tipo não aceito");
    expect(rejected.find((r) => r.name === "video.mp4")?.reason).toContain("Tipo não aceito");
  });

  it("CA-S1-19: o sexto arquivo é recusado pelo limite por atividade, contando os já selecionados", () => {
    const six = Array.from({ length: 6 }, (_, i) => f(`a${i}.png`, "image/png"));
    const r1 = validateAttachments(0, six);
    expect(r1.accepted).toHaveLength(MAX_ATTACHMENTS_PER_ACTIVITY);
    expect(r1.rejected[0].reason).toContain("Máximo de 5");
    const r2 = validateAttachments(4, [f("x.png", "image/png"), f("y.png", "image/png")]);
    expect(r2.accepted.map((a) => a.name)).toEqual(["x.png"]);
    expect(r2.rejected.map((a) => a.name)).toEqual(["y.png"]);
  });

  it("CA-S1-18: atividade só com anexo pode ser salva; sem texto e sem arquivo, não", () => {
    expect(canSubmitActivity("", 1)).toBe(true);
    expect(canSubmitActivity("   ", 2)).toBe(true);
    expect(canSubmitActivity("texto", 0)).toBe(true);
    expect(canSubmitActivity("", 0)).toBe(false);
  });

  it("CA-S1-17: imagens são exibidas como miniatura (e PDF como link)", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime(null)).toBe(false);
    expect(formatBytes(320 * 1024)).toBe("320 KB");
  });

  it("monta o caminho lead/atividade/arquivo sem acentos nem espaços", () => {
    const p = buildAttachmentPath("lead-1", "act-2", "Conversa João (final).png", "n1");
    expect(p).toBe("lead-1/act-2/n1-Conversa_Joao_final_.png");
  });
});
