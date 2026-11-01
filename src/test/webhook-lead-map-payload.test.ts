import { describe, it, expect } from "vitest";
import { mapPayloadToLead, normalizeStatus } from "../../supabase/functions/webhook-lead/map-payload";

describe("mapPayloadToLead — atribuição", () => {
  it("lê fbc, gclid e external_id de dentro de `attribution` (payload do tracking)", () => {
    const lead = mapPayloadToLead({
      nome: "Ana",
      telefone: "11999990000",
      email: "ana@x.com",
      funnel: "sessao-estrategica",
      utm_source: "facebookads",
      attribution: {
        utm_source: "facebookads",
        fbclid: "IwAR...",
        gclid: "Cj0K...",
        fbc: "fb.1.1700000000.IwAR...",
        external_id: "ext-123",
        landing_url: "https://atacadoexponencial.com/se",
      },
    });
    expect(lead.fbc).toBe("fb.1.1700000000.IwAR...");
    expect(lead.gclid).toBe("Cj0K...");
    expect(lead.external_id).toBe("ext-123");
    expect(lead.whatsapp).toBe("11999990000");
    expect(lead.funil).toBe("sessao-estrategica");
    expect(lead.utm_source).toBe("facebookads");
  });

  it("a raiz tem precedência sobre `attribution` quando as duas trazem a chave", () => {
    const lead = mapPayloadToLead({
      nome: "Bia",
      utm_campaign: "raiz",
      attribution: { utm_campaign: "aninhada", fbc: "fb.1.2.3" },
    });
    expect(lead.utm_campaign).toBe("raiz");
    expect(lead.fbc).toBe("fb.1.2.3");
  });

  it("continua funcionando com payload só na raiz (sem `attribution`)", () => {
    const lead = mapPayloadToLead({ nome: "Caio", fbc: "fb.1.9.9", gclid: "g1", external_id: "e1" });
    expect(lead.fbc).toBe("fb.1.9.9");
    expect(lead.gclid).toBe("g1");
    expect(lead.external_id).toBe("e1");
  });

  it("sem atribuição em lugar nenhum, os campos ficam null", () => {
    const lead = mapPayloadToLead({ nome: "Dani" });
    expect(lead.fbc).toBeNull();
    expect(lead.gclid).toBeNull();
    expect(lead.external_id).toBeNull();
  });

  it("ignora `attribution` que não seja objeto e strings vazias dentro dele", () => {
    const a = mapPayloadToLead({ nome: "Edu", attribution: "x" });
    expect(a.fbc).toBeNull();
    const b = mapPayloadToLead({ nome: "Edu", attribution: { fbc: "", gclid: null } });
    expect(b.fbc).toBeNull();
    expect(b.gclid).toBeNull();
  });
});

describe("mapPayloadToLead — comportamento preservado", () => {
  it("nome padrão, status padrão e created_at a partir de data_criada", () => {
    const lead = mapPayloadToLead({ data_criada: "2026-10-01" });
    expect(lead.nome).toBe("Lead");
    expect(lead.status).toBe("leads_entrada");
    expect(lead.created_at).toBe("2026-10-01T00:00:00Z");
  });

  it("converte oportunidade em formato BRL e normaliza status", () => {
    const lead = mapPayloadToLead({ nome: "Fê", valor: "R$ 1.500,50", status: "Reunião" });
    expect(lead.oportunidade).toBe(1500.5);
    expect(lead.status).toBe("reuniao");
    expect(normalizeStatus("qualquer coisa")).toBe("leads_entrada");
  });
});
