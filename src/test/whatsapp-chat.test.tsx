import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { groupByDay, windowState, windowLabel, composerMode, upsertMessage, validateOutboundFile, outboundMediaPath } from "@/lib/whatsapp-chat";
import { Composer } from "@/components/whatsapp/Composer";

const noop = () => {};
const tpl = [{ id: "t1", name: "retomar_contato", language: "pt_BR", status: "APPROVED", category: "MARKETING", components: [{ type: "BODY", text: "Oi {{1}}" }] }];

describe("conversa no painel do lead — regras de exibição", () => {
  it("CA-S2-23: lead sem conversa (ou janela fechada) só pode receber template", () => {
    expect(composerMode(windowState(null))).toBe("template");
    expect(composerMode(windowState("2020-01-01T00:00:00Z"))).toBe("template");
    expect(composerMode(windowState(new Date(Date.now() - 3600_000).toISOString()))).toBe("livre");
    expect(windowLabel(windowState(null))).toBe("Fechada: envie um template");
    expect(windowLabel(windowState(new Date(Date.now() - 3600_000).toISOString()))).toMatch(/^Aberta até /);
  });

  it("CA-S2-23: sem janela, a caixa de texto livre não aparece e o seletor de template está disponível", () => {
    render(<Composer window={windowState(null)} templates={tpl} sending={false} onSendText={noop} onSendFile={noop} onSendTemplate={noop} />);
    expect(screen.getByTestId("composer-template")).toBeInTheDocument();
    expect(screen.getByTestId("template-picker")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Mensagem" })).toBeNull();
  });

  it("CA-S2-23: com a janela aberta, a caixa de texto está habilitada", () => {
    render(<Composer window={windowState(new Date().toISOString())} templates={tpl} sending={false} onSendText={noop} onSendFile={noop} onSendTemplate={noop} />);
    expect(screen.getByRole("textbox", { name: "Mensagem" })).not.toBeDisabled();
  });

  it("CA-S2-22: mensagem que chega em tempo real entra no fim, e atualização de status substitui a existente", () => {
    const a = { id: "1", created_at: "2026-11-01T10:00:00Z", status: "enviado" };
    const b = { id: "2", created_at: "2026-11-01T10:05:00Z", status: null };
    let list = upsertMessage([a], b);
    expect(list.map((m) => m.id)).toEqual(["1", "2"]);
    list = upsertMessage(list, { ...a, status: "lido" });
    expect(list).toHaveLength(2);
    expect(list[0].status).toBe("lido");
  });

  it("mensagens agrupadas por dia em ordem cronológica; arquivos de saída validados", () => {
    const g = groupByDay([
      { id: "3", created_at: "2026-10-30T15:00:00Z" },
      { id: "1", created_at: "2026-10-29T12:00:00Z" },
      { id: "2", created_at: "2026-10-29T13:00:00Z" },
    ]);
    expect(g.map((x) => [x.day, x.items.map((i) => i.id)])).toEqual([["2026-10-29", ["1", "2"]], ["2026-10-30", ["3"]]]);
    expect(validateOutboundFile({ type: "image/png", size: 100 })).toBeNull();
    expect(validateOutboundFile({ type: "image/webp", size: 100 })).toContain("JPG/PNG");
    expect(validateOutboundFile({ type: "application/pdf", size: 20 * 1024 * 1024 })).toContain("16 MB");
    expect(outboundMediaPath("lead-1", "Proposta Final.PDF", "n1")).toBe("lead-1/out/n1.pdf");
  });
});
