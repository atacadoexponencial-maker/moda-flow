import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  listAllTemplates,
  syncTemplates,
  approvedForSend,
  templateVariables,
  allVariablesFilled,
  renderTemplateText,
  fillTemplate,
  buildSendComponents,
  sanitizeVariable,
  type MetaTemplate,
} from "../../supabase/functions/_shared/whatsapp-templates";
import { GRAPH } from "../../supabase/functions/_shared/whatsapp-graph";
import { TemplatePicker } from "@/components/whatsapp/TemplatePicker";

const body = (text: string) => [{ type: "BODY", text }];

function metaPage(data: Array<Partial<MetaTemplate> & { name: string }>, next?: string) {
  return {
    data: data.map((t, i) => ({ id: t.id ?? `id-${t.name}-${i}`, language: "pt_BR", category: "MARKETING", status: "APPROVED", components: body("Oi"), ...t })),
    ...(next ? { paging: { next } } : {}),
  };
}

describe("templates — sincronização", () => {
  it("CA-S2-29: sincronizar copia todos os templates da conta (com paginação) com nome, idioma, categoria e status iguais aos da Meta", async () => {
    const page2 = "https://graph.facebook.com/v26.0/WABA/message_templates?after=CURSOR";
    const calls: string[] = [];
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push(`${url} ${new Headers(init?.headers).get("Authorization")}`);
      if (url === page2) return new Response(JSON.stringify(metaPage([{ name: "follow_up_3d", language: "pt_BR", status: "REJECTED", rejected_reason: "INVALID_FORMAT" }])));
      if (url.startsWith(`${GRAPH}/WABA/message_templates?fields=`)) {
        return new Response(JSON.stringify(metaPage([
          { name: "boas_vindas", category: "UTILITY", status: "APPROVED" },
          { name: "promo_novembro", category: "MARKETING", status: "PENDING" },
        ], page2)));
      }
      return new Response("{}", { status: 404 });
    };
    let stored: MetaTemplate[] = [];
    const r = await syncTemplates({ fetch: fetchFn, token: "TK", wabaId: "WABA", store: { replaceAll: async (t) => { stored = t; } } });

    expect(r).toEqual({ ok: true, count: 3 });
    expect(stored.map((t) => [t.name, t.language, t.category, t.status])).toEqual([
      ["boas_vindas", "pt_BR", "UTILITY", "APPROVED"],
      ["promo_novembro", "pt_BR", "MARKETING", "PENDING"],
      ["follow_up_3d", "pt_BR", "MARKETING", "REJECTED"],
    ]);
    expect(stored[2].rejected_reason).toBe("INVALID_FORMAT");
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.endsWith("Bearer TK"))).toBe(true);
  });

  it("CA-S2-29: erro da Meta não apaga a cópia local", async () => {
    const fetchFn = async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token." } }), { status: 401 });
    let touched = false;
    const r = await syncTemplates({ fetch: fetchFn, token: "x", wabaId: "WABA", store: { replaceAll: async () => { touched = true; } } });
    expect(r).toEqual({ ok: false, error: "Invalid OAuth access token." });
    expect(touched).toBe(false);
    expect((await listAllTemplates(fetchFn, "x", "WABA")).ok).toBe(false);
  });
});

describe("templates — seletor de envio", () => {
  const list = [
    { id: "1", name: "boas_vindas", language: "pt_BR", status: "APPROVED", category: "UTILITY", components: body("Olá {{1}}!") },
    { id: "2", name: "aguardando", language: "pt_BR", status: "PENDING", category: "MARKETING", components: body("x") },
    { id: "3", name: "reprovado", language: "pt_BR", status: "REJECTED", category: "MARKETING", components: body("x") },
    { id: "4", name: "codigo", language: "pt_BR", status: "APPROVED", category: "AUTHENTICATION", components: body("{{1}}") },
    { id: "5", name: "a_follow", language: "en_US", status: "APPROVED", category: "MARKETING", components: body("Hi") },
  ];

  it("CA-S2-30: só templates aprovados (e não de autenticação) aparecem no seletor", () => {
    expect(approvedForSend(list).map((t) => t.name)).toEqual(["a_follow", "boas_vindas"]);
  });

  it("CA-S2-30: sem nenhum aprovado, o seletor avisa e não oferece envio", () => {
    render(<TemplatePicker templates={list.filter((t) => t.status !== "APPROVED")} onSend={() => {}} />);
    expect(screen.getByText(/Nenhum template aprovado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar template/ })).toBeNull();
  });

  it("CA-S2-31: a prévia substitui as variáveis e o envio só habilita com todas preenchidas", () => {
    const comps = body("Olá {{1}}, sua reunião é {{2}}. Até lá!");
    const vars = templateVariables(comps);
    expect(vars).toEqual({ header: 0, body: 2 });
    expect(renderTemplateText(comps, [], ["Ana", "quarta-feira"])).toBe("Olá Ana, sua reunião é quarta-feira. Até lá!");
    expect(allVariablesFilled(vars, [], ["Ana", "quarta-feira"])).toBe(true);
    expect(allVariablesFilled(vars, [], ["Ana", ""])).toBe(false);
    expect(allVariablesFilled(vars, [], ["Ana", "   "])).toBe(false);
    expect(fillTemplate("Olá {{1}}", [])).toBe("Olá {{1}}");
  });

  it("CA-S2-31: cabeçalho com variável e valores limpos como a Meta exige", () => {
    const comps = [{ type: "HEADER", format: "TEXT", text: "Oi {{1}}" }, { type: "BODY", text: "Corpo {{1}}" }, { type: "FOOTER", text: "Sete" }];
    const vars = templateVariables(comps);
    expect(vars).toEqual({ header: 1, body: 1 });
    expect(renderTemplateText(comps, ["Ana"], ["texto"])).toBe("Oi Ana\n\nCorpo texto\n\nSete");
    expect(sanitizeVariable("linha1\nlinha2\t     fim")).toBe("linha1 linha2   fim");
    expect(buildSendComponents(["Ana"], ["texto"], vars)).toEqual([
      { type: "header", parameters: [{ type: "text", text: "Ana" }] },
      { type: "body", parameters: [{ type: "text", text: "texto" }] },
    ]);
  });
});
