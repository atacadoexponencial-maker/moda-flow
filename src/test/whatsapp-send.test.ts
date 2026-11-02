import { describe, it, expect } from "vitest";
import { sendMessage, toWhatsAppNumber, type SendRepo, type MessageRow, type StoredTemplate } from "../../supabase/functions/_shared/whatsapp-send";
import { GRAPH } from "../../supabase/functions/_shared/whatsapp-graph";

const NOW = new Date("2026-11-01T15:00:00Z");
const OPEN = "2026-11-01T10:00:00Z"; // recebida há 5h → janela aberta
const CLOSED = "2026-10-30T10:00:00Z";
const ME = { userId: "user-1", email: "ana@empresa.com" };

const TPL: StoredTemplate = {
  name: "lembrete_reuniao", language: "pt_BR", status: "APPROVED", category: "UTILITY",
  components: [{ type: "BODY", text: "Olá {{1}}, sua reunião é {{2}}." }],
};

function fakeRepo(opts: { lastInbound?: string | null; conversation?: boolean; whatsapp?: string | null; config?: boolean; template?: StoredTemplate | null } = {}) {
  const st = {
    messages: new Map<string, Omit<MessageRow, "status"> & { status: string; wamid?: string; status_error?: string }>(),
    conv: opts.conversation === false ? null : { id: "conv-1", last_inbound_at: "lastInbound" in opts ? opts.lastInbound ?? null : OPEN },
    touchedConv: null as null | { preview: string; at: string },
    touchedLead: null as null | string,
    created: 0,
  };
  const repo: SendRepo = {
    getLead: async (id) => (id === "lead-1" ? { id, whatsapp: opts.whatsapp === undefined ? "(11) 98765-4321" : opts.whatsapp } : null),
    getConversation: async () => st.conv,
    ensureConversation: async () => { st.created++; st.conv = { id: "conv-new", last_inbound_at: null }; return st.conv; },
    getConfig: async () => (opts.config === false ? null : { phone_number_id: "PHONE1", token: "TK" }),
    getTemplate: async (n, l) => (opts.template === undefined ? TPL : opts.template) && n === TPL.name && l === TPL.language ? (opts.template === undefined ? TPL : opts.template) : null,
    signedUrl: async (p) => (p.startsWith("lead-1/") ? `https://storage.local/${p}?token=x` : null),
    insertMessage: async (row) => { const id = `msg-${st.messages.size + 1}`; st.messages.set(id, { ...row }); return id; },
    markSent: async (id, wamid) => { const m = st.messages.get(id)!; m.status = "enviado"; m.wamid = wamid; },
    markFailed: async (id, err) => { const m = st.messages.get(id)!; m.status = "falhou"; m.status_error = err; },
    touchConversation: async (_c, preview, at) => { st.touchedConv = { preview, at }; },
    touchLead: async (_l, day) => { st.touchedLead = day; },
  };
  return { repo, st };
}

function fakeMeta(response: { status?: number; body: unknown }) {
  const sent: Array<{ url: string; body: Record<string, unknown>; auth: string | null }> = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body ?? "{}")), auth: new Headers(init?.headers).get("Authorization") });
    return new Response(JSON.stringify(response.body), { status: response.status ?? 200 });
  };
  return { fetchFn, sent };
}

const OK = { body: { messages: [{ id: "wamid.OUT1" }] } };

describe("envio de mensagens", () => {
  it("CA-S2-14: texto dentro da janela é gravado como enviado com wamid, autor e horário, e atualiza o último contato", async () => {
    const { repo, st } = fakeRepo();
    const meta = fakeMeta(OK);
    const r = await sendMessage({ lead_id: "lead-1", kind: "text", text: "  Oi Ana, tudo bem?  " }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });

    expect(r).toEqual({ ok: true, message_id: "msg-1", wamid: "wamid.OUT1" });
    const m = st.messages.get("msg-1")!;
    expect(m).toMatchObject({ direction: "enviada", type: "texto", content: "Oi Ana, tudo bem?", status: "enviado", wamid: "wamid.OUT1", sent_by: "user-1", sent_by_email: "ana@empresa.com", phone_number_id: "PHONE1" });
    expect(meta.sent[0].url).toBe(`${GRAPH}/PHONE1/messages`);
    expect(meta.sent[0].auth).toBe("Bearer TK");
    expect(meta.sent[0].body).toMatchObject({ messaging_product: "whatsapp", to: "5511987654321", type: "text", text: { body: "Oi Ana, tudo bem?" } });
    expect(st.touchedConv).toEqual({ preview: "Oi Ana, tudo bem?", at: NOW.toISOString() });
    expect(st.touchedLead).toBe("2026-11-01");
  });

  it("CA-S2-15: imagem ou PDF sai com link do armazenamento privado e fica ligada à mensagem", async () => {
    const { repo, st } = fakeRepo();
    const meta = fakeMeta(OK);
    const img = await sendMessage({ lead_id: "lead-1", kind: "media", media_path: "lead-1/out/a.png", media_mime: "image/png", media_size: 300_000 }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
    expect(img.ok).toBe(true);
    expect(meta.sent[0].body).toMatchObject({ type: "image", image: { link: "https://storage.local/lead-1/out/a.png?token=x" } });
    expect(st.messages.get("msg-1")).toMatchObject({ type: "imagem", media_path: "lead-1/out/a.png", media_mime: "image/png", media_status: "ok", status: "enviado" });

    const pdf = await sendMessage({ lead_id: "lead-1", kind: "media", media_path: "lead-1/out/p.pdf", media_mime: "application/pdf", media_filename: "proposta.pdf", media_size: 2_000_000 }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
    expect(pdf.ok).toBe(true);
    expect(meta.sent[1].body).toMatchObject({ type: "document", document: { filename: "proposta.pdf" } });

    const big = await sendMessage({ lead_id: "lead-1", kind: "media", media_path: "lead-1/out/b.jpg", media_mime: "image/jpeg", media_size: 6 * 1024 * 1024 }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
    expect(big).toMatchObject({ ok: false, code: "midia" });
    const webp = await sendMessage({ lead_id: "lead-1", kind: "media", media_path: "lead-1/out/c.webp", media_mime: "image/webp", media_size: 10 }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
    expect(webp).toMatchObject({ ok: false, code: "midia" });
    expect(meta.sent).toHaveLength(2);
  });

  it("CA-S2-16: com a janela fechada (ou sem conversa) texto e mídia são recusados sem chamar a Meta", async () => {
    for (const opts of [{ lastInbound: CLOSED }, { lastInbound: null }, { conversation: false }]) {
      const { repo, st } = fakeRepo(opts);
      const meta = fakeMeta(OK);
      const r = await sendMessage({ lead_id: "lead-1", kind: "text", text: "oi" }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
      expect(r).toEqual({ ok: false, code: "janela_fechada", error: "Janela de 24 horas fechada. Envie um template." });
      expect(meta.sent).toHaveLength(0);
      expect(st.messages.size).toBe(0);
    }
  });

  it("CA-S2-17: template com variáveis sai mesmo com a janela fechada e o balão guarda o texto final", async () => {
    const { repo, st } = fakeRepo({ conversation: false });
    const meta = fakeMeta(OK);
    const r = await sendMessage({ lead_id: "lead-1", kind: "template", template_name: "lembrete_reuniao", language: "pt_BR", body_values: ["Ana", "quarta-feira"] }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
    expect(r.ok).toBe(true);
    expect(meta.sent[0].body).toMatchObject({
      type: "template",
      template: { name: "lembrete_reuniao", language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "quarta-feira" }] }] },
    });
    expect(st.created).toBe(1); // conversa criada para o lead
    expect(st.messages.get("msg-1")).toMatchObject({ type: "template", content: "Olá Ana, sua reunião é quarta-feira.", status: "enviado" });

    const missing = await sendMessage({ lead_id: "lead-1", kind: "template", template_name: "lembrete_reuniao", language: "pt_BR", body_values: ["Ana"] }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
    expect(missing).toMatchObject({ ok: false, code: "template" });
    const { repo: r2 } = fakeRepo({ template: { ...TPL, status: "PENDING" } });
    const pending = await sendMessage({ lead_id: "lead-1", kind: "template", template_name: "lembrete_reuniao", language: "pt_BR", body_values: ["a", "b"] }, ME, { fetch: meta.fetchFn, repo: r2, now: () => NOW });
    expect(pending).toMatchObject({ ok: false, code: "template" });
  });

  it("CA-S2-19: recusa da Meta deixa a mensagem como falhou com o motivo em linguagem simples", async () => {
    const { repo, st } = fakeRepo();
    const meta = fakeMeta({ status: 400, body: { error: { code: 131047, message: "Re-engagement message" } } });
    const r = await sendMessage({ lead_id: "lead-1", kind: "text", text: "oi" }, ME, { fetch: meta.fetchFn, repo, now: () => NOW });
    expect(r).toEqual({ ok: false, code: "meta", error: "Janela de 24 horas fechada. Envie um template.", message_id: "msg-1" });
    expect(st.messages.get("msg-1")).toMatchObject({ status: "falhou", status_error: "Janela de 24 horas fechada. Envie um template." });
    expect(st.touchedLead).toBeNull();

    const { repo: r2, st: s2 } = fakeRepo();
    const limit = fakeMeta({ status: 429, body: { error: { code: 130429, message: "Rate limit hit" } } });
    await sendMessage({ lead_id: "lead-1", kind: "text", text: "oi" }, ME, { fetch: limit.fetchFn, repo: r2, now: () => NOW });
    expect(s2.messages.get("msg-1")?.status_error).toBe("Limite de envio da Meta atingido. Aguarde alguns minutos e tente de novo.");
  });

  it("sem número conectado ou lead sem WhatsApp, nada é enviado", async () => {
    const meta = fakeMeta(OK);
    expect(await sendMessage({ lead_id: "lead-1", kind: "text", text: "oi" }, ME, { fetch: meta.fetchFn, repo: fakeRepo({ config: false }).repo, now: () => NOW })).toMatchObject({ ok: false, code: "sem_conexao" });
    expect(await sendMessage({ lead_id: "lead-1", kind: "text", text: "oi" }, ME, { fetch: meta.fetchFn, repo: fakeRepo({ whatsapp: null }).repo, now: () => NOW })).toMatchObject({ ok: false, code: "sem_telefone" });
    expect(meta.sent).toHaveLength(0);
    expect(toWhatsAppNumber("+55 (11) 98765-4321")).toBe("5511987654321");
    expect(toWhatsAppNumber("11987654321")).toBe("5511987654321");
    expect(toWhatsAppNumber("351912345678")).toBe("351912345678");
  });
});
