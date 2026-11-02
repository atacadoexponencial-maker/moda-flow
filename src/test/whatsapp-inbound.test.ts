import { describe, it, expect } from "vitest";
import { parseWebhook, verifySignature, signBody, toInbound } from "../../supabase/functions/_shared/whatsapp-inbound";
import { storeInboundMedia, MAX_MEDIA_BYTES, extensionFor } from "../../supabase/functions/_shared/whatsapp-media";
import { windowState } from "../../supabase/functions/_shared/whatsapp-window";
import { GRAPH } from "../../supabase/functions/_shared/whatsapp-graph";

const PHONE_ID = "111222333";
const OTHER_ID = "999888777";

function payload(phoneId: string, value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: phoneId }, ...value } }] }],
  };
}

const textMsg = (id: string, body = "Oi, quero saber do workshop") => ({
  contacts: [{ wa_id: "5511987654321", profile: { name: "Ana Souza" } }],
  messages: [{ from: "5511987654321", id, timestamp: "1730462400", type: "text", text: { body } }],
});

describe("webhook do WhatsApp — leitura do payload", () => {
  it("CA-S2-07: mensagem de texto vira mensagem recebida com texto, autor do perfil e horário da Meta", () => {
    const p = parseWebhook(payload(PHONE_ID, textMsg("wamid.A")), PHONE_ID);
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0]).toMatchObject({
      from: "5511987654321", profile_name: "Ana Souza", wamid: "wamid.A", type: "texto",
      content: "Oi, quero saber do workshop", timestamp: new Date(1730462400 * 1000).toISOString(),
      preview: "Oi, quero saber do workshop",
    });
  });

  it("CA-S2-07: tipos de mensagem são reconhecidos (mídia, localização, contato, botão, reação, citação)", () => {
    const base = { from: "5511987654321", timestamp: "1730462400" };
    expect(toInbound({ ...base, id: "1", type: "image", image: { id: "M1", mime_type: "image/jpeg", caption: "print" } }, PHONE_ID, null))
      .toMatchObject({ type: "imagem", media: { id: "M1", mime_type: "image/jpeg" }, content: "print" });
    expect(toInbound({ ...base, id: "2", type: "document", document: { id: "M2", mime_type: "application/pdf", filename: "proposta.pdf" } }, PHONE_ID, null))
      .toMatchObject({ type: "documento", media: { id: "M2", filename: "proposta.pdf" } });
    expect(toInbound({ ...base, id: "3", type: "audio", audio: { id: "M3", mime_type: "audio/ogg; codecs=opus" } }, PHONE_ID, null).type).toBe("audio");
    expect(toInbound({ ...base, id: "4", type: "location", location: { latitude: -23.5, longitude: -46.6, name: "Escritório" } }, PHONE_ID, null).content)
      .toBe("Escritório\nhttps://maps.google.com/?q=-23.5,-46.6");
    expect(toInbound({ ...base, id: "5", type: "button", button: { text: "Quero participar" } }, PHONE_ID, null)).toMatchObject({ type: "texto", content: "Quero participar" });
    expect(toInbound({ ...base, id: "6", type: "reaction", reaction: { message_id: "wamid.X", emoji: "👍" } }, PHONE_ID, null))
      .toMatchObject({ type: "reacao", content: "👍", reply_to_wamid: "wamid.X" });
    expect(toInbound({ ...base, id: "7", type: "text", text: { body: "sim" }, context: { id: "wamid.Y" } }, PHONE_ID, null).reply_to_wamid).toBe("wamid.Y");
    expect(toInbound({ ...base, id: "8", type: "unsupported" }, PHONE_ID, null).type).toBe("desconhecido");
  });

  it("CA-S2-11: eventos de outro número (ou sem número configurado) são ignorados", () => {
    const other = parseWebhook(payload(OTHER_ID, textMsg("wamid.B")), PHONE_ID);
    expect(other.messages).toHaveLength(0);
    expect(other.ignored).toBe(1);
    expect(parseWebhook(payload(PHONE_ID, textMsg("wamid.C")), null).messages).toHaveLength(0);
    expect(parseWebhook({ object: "page", entry: [] }, PHONE_ID).messages).toHaveLength(0);
  });

  it("status da Meta são lidos com o erro da falha", () => {
    const p = parseWebhook(payload(PHONE_ID, {
      statuses: [
        { id: "wamid.S1", status: "delivered" },
        { id: "wamid.S2", status: "failed", errors: [{ code: 131047, title: "Re-engagement message" }] },
      ],
    }), PHONE_ID);
    expect(p.statuses).toEqual([
      { phone_number_id: PHONE_ID, wamid: "wamid.S1", status: "entregue", error_code: null, error_title: null },
      { phone_number_id: PHONE_ID, wamid: "wamid.S2", status: "falhou", error_code: 131047, error_title: "Re-engagement message" },
    ]);
  });
});

describe("webhook do WhatsApp — assinatura", () => {
  it("CA-S2-12: assinatura que não confere com o segredo do app é recusada", async () => {
    const raw = JSON.stringify(payload(PHONE_ID, textMsg("wamid.D")));
    const sig = await signBody("segredo-certo", raw);
    expect(await verifySignature(raw, `sha256=${sig}`, "segredo-certo")).toBe(true);
    expect(await verifySignature(raw, `sha256=${sig}`, "segredo-errado")).toBe(false);
    expect(await verifySignature(raw + " ", `sha256=${sig}`, "segredo-certo")).toBe(false);
    expect(await verifySignature(raw, null, "segredo-certo")).toBe(false);
    expect(await verifySignature(raw, `sha256=${sig}`, undefined)).toBe(false);
  });
});

describe("webhook do WhatsApp — mídia", () => {
  it("CA-S2-09: a mídia é buscada na Meta com o token e guardada no armazenamento privado do CRM", async () => {
    const uploads: Array<{ path: string; size: number; type: string }> = [];
    const calls: string[] = [];
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push(`${url} ${new Headers(init?.headers).get("Authorization")}`);
      if (url === `${GRAPH}/MEDIA1`) return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/x", mime_type: "image/jpeg", file_size: 3 }));
      if (url === "https://lookaside.fbsbx.com/x") return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
      return new Response("{}", { status: 404 });
    };
    const r = await storeInboundMedia({
      fetch: fetchFn, token: "TK", mediaId: "MEDIA1", leadId: "lead-1", wamid: "wamid.HBg=",
      upload: async (path, bytes, type) => { uploads.push({ path, size: bytes.byteLength, type }); },
    });
    expect(r).toEqual({ status: "ok", path: "lead-1/wamidHBg.jpg", mime: "image/jpeg", size: 3 });
    expect(uploads).toEqual([{ path: "lead-1/wamidHBg.jpg", size: 3, type: "image/jpeg" }]);
    expect(calls.every((c) => c.endsWith("Bearer TK"))).toBe(true);
  });

  it("CA-S2-09: arquivo acima de 16 MB não é baixado; falha da Meta é registrada", async () => {
    const big = async () => new Response(JSON.stringify({ url: "https://x/y", mime_type: "video/mp4", file_size: MAX_MEDIA_BYTES + 1 }));
    const r1 = await storeInboundMedia({ fetch: big, token: "T", mediaId: "M", leadId: "l", wamid: "w", upload: async () => { throw new Error("não deveria subir"); } });
    expect(r1).toEqual({ status: "grande_demais", size: MAX_MEDIA_BYTES + 1 });
    const bad = async () => new Response(JSON.stringify({ error: { message: "Invalid media id" } }), { status: 400 });
    const r2 = await storeInboundMedia({ fetch: bad, token: "T", mediaId: "M", leadId: "l", wamid: "w", upload: async () => {} });
    expect(r2).toEqual({ status: "falhou", error: "Invalid media id" });
    expect(extensionFor("audio/ogg; codecs=opus")).toBe("ogg");
    expect(extensionFor("application/x-desconhecido", "planilha.ods")).toBe("ods");
  });
});

describe("janela de 24 horas", () => {
  it("CA-S2-13: a janela abre com a mensagem recebida e mostra quando fecha; sem mensagem há 24h, fechada", () => {
    const now = new Date("2026-11-02T10:00:00Z");
    expect(windowState(null, now)).toEqual({ open: false, closesAt: null });
    expect(windowState("2026-11-01T09:59:00Z", now)).toEqual({ open: false, closesAt: null });
    expect(windowState("2026-11-02T09:00:00Z", now)).toEqual({ open: true, closesAt: "2026-11-03T09:00:00.000Z" });
  });
});
