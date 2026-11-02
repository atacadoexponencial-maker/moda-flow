// Envio de mensagens pelo WhatsApp Cloud API (S2-04). Módulo puro: a Edge
// Function injeta `fetch` e um repositório; os testes injetam dublês.
// Base: crm-exponencial src/lib/whatsapp/provider-meta.ts.
import { GRAPH, type FetchLike } from "./whatsapp-graph.ts";
import { windowState } from "./whatsapp-window.ts";
import { metaErrorPt } from "./whatsapp-errors.ts";
import {
  templateVariables,
  allVariablesFilled,
  renderTemplateText,
  buildSendComponents,
  approvedForSend,
  type TemplateComponent,
} from "./whatsapp-templates.ts";

export const OUT_IMAGE_MIME = ["image/jpeg", "image/png"];
export const OUT_DOC_MIME = ["application/pdf"];
export const MAX_OUT_IMAGE_BYTES = 5 * 1024 * 1024; // limite da Meta para imagem
export const MAX_OUT_DOC_BYTES = 16 * 1024 * 1024; // SUP-S2-04

/** Número no formato da Meta (só dígitos, com DDI). Brasil sem DDI ganha 55. */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d.length >= 8 ? d : null;
}

export type SendKind = "text" | "media" | "template";

export interface SendInput {
  lead_id: string;
  kind: SendKind;
  text?: string;
  media_path?: string;
  media_mime?: string;
  media_filename?: string;
  media_size?: number;
  template_name?: string;
  language?: string;
  header_values?: string[];
  body_values?: string[];
}

export interface SenderIdentity {
  userId: string;
  email: string | null;
}

export interface StoredTemplate {
  name: string;
  language: string;
  status: string;
  category: string | null;
  components: TemplateComponent[];
}

export interface MessageRow {
  conversation_id: string;
  lead_id: string;
  direction: "enviada";
  type: "texto" | "imagem" | "documento" | "template";
  content: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_filename: string | null;
  media_size: number | null;
  media_status: "ok" | null;
  status: "enviando";
  sent_by: string;
  sent_by_email: string | null;
  phone_number_id: string;
}

export interface SendRepo {
  getLead(id: string): Promise<{ id: string; whatsapp: string | null } | null>;
  getConversation(leadId: string): Promise<{ id: string; last_inbound_at: string | null } | null>;
  ensureConversation(leadId: string): Promise<{ id: string; last_inbound_at: string | null }>;
  getConfig(): Promise<{ phone_number_id: string; token: string } | null>;
  getTemplate(name: string, language: string): Promise<StoredTemplate | null>;
  signedUrl(path: string): Promise<string | null>;
  insertMessage(row: MessageRow): Promise<string>;
  markSent(id: string, wamid: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  touchConversation(conversationId: string, preview: string, at: string): Promise<void>;
  touchLead(leadId: string, day: string): Promise<void>;
}

export type SendErrorCode =
  | "dados" | "lead" | "sem_telefone" | "janela_fechada" | "sem_conexao" | "template" | "midia" | "meta";

export type SendResult =
  | { ok: true; message_id: string; wamid: string }
  | { ok: false; code: SendErrorCode; error: string; message_id?: string };

/** Envia o payload à Meta. Resposta OK traz `messages[0].id` (wamid). */
export async function postToMeta(fetchFn: FetchLike, token: string, phoneNumberId: string, payload: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetchFn(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    });
  } catch (e) {
    return { ok: false as const, code: null as number | null, message: `Falha de rede: ${e instanceof Error ? e.message : String(e)}` };
  }
  const body = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { code?: number; message?: string; error_user_msg?: string; error_data?: { details?: string } } };
  if (!res.ok || body.error || !body.messages?.[0]?.id) {
    const e = body.error ?? {};
    return { ok: false as const, code: e.code ?? null, message: metaErrorPt(e.code, e.error_user_msg ?? e.error_data?.details ?? e.message) };
  }
  return { ok: true as const, wamid: body.messages[0].id };
}

function validate(input: SendInput): string | null {
  if (!input?.lead_id) return "Lead não informado.";
  if (input.kind === "text") return (input.text ?? "").trim() ? null : "Escreva a mensagem.";
  if (input.kind === "media") {
    if (!input.media_path || !input.media_mime) return "Arquivo não informado.";
    const isImg = OUT_IMAGE_MIME.includes(input.media_mime);
    const isDoc = OUT_DOC_MIME.includes(input.media_mime);
    if (!isImg && !isDoc) return "Envie imagem JPG/PNG ou PDF.";
    const max = isImg ? MAX_OUT_IMAGE_BYTES : MAX_OUT_DOC_BYTES;
    if ((input.media_size ?? 0) > max) return isImg ? "Imagem acima de 5 MB." : "PDF acima de 16 MB.";
    return null;
  }
  if (input.kind === "template") return input.template_name && input.language ? null : "Template não informado.";
  return "Tipo de envio inválido.";
}

/**
 * Regras do envio: janela de 24h para texto/mídia (fora dela, só template),
 * grava a mensagem como "enviando" com o autor, envia, marca "enviado" com o
 * wamid ou "falhou" com o motivo em português; atualiza conversa e último
 * contato do lead (SUP-S2-03).
 */
export async function sendMessage(
  input: SendInput,
  sender: SenderIdentity,
  deps: { fetch: FetchLike; repo: SendRepo; now?: () => Date },
): Promise<SendResult> {
  const now = (deps.now ?? (() => new Date()))();
  const invalid = validate(input);
  if (invalid) return { ok: false, code: input?.kind === "media" ? "midia" : "dados", error: invalid };

  const lead = await deps.repo.getLead(input.lead_id);
  if (!lead) return { ok: false, code: "lead", error: "Lead não encontrado." };
  const to = toWhatsAppNumber(lead.whatsapp);
  if (!to) return { ok: false, code: "sem_telefone", error: "O lead não tem WhatsApp válido." };

  const existing = await deps.repo.getConversation(lead.id);
  if (input.kind !== "template" && !windowState(existing?.last_inbound_at, now).open) {
    return { ok: false, code: "janela_fechada", error: "Janela de 24 horas fechada. Envie um template." };
  }

  const config = await deps.repo.getConfig();
  if (!config) return { ok: false, code: "sem_conexao", error: "Nenhum número de WhatsApp conectado." };

  let payload: Record<string, unknown>;
  let type: MessageRow["type"];
  let content: string | null;
  let preview: string;

  if (input.kind === "text") {
    content = input.text!.trim();
    payload = { to, type: "text", text: { body: content, preview_url: true } };
    type = "texto";
    preview = content.slice(0, 120);
  } else if (input.kind === "media") {
    const link = await deps.repo.signedUrl(input.media_path!);
    if (!link) return { ok: false, code: "midia", error: "Arquivo não encontrado no armazenamento." };
    const isImg = OUT_IMAGE_MIME.includes(input.media_mime!);
    const caption = (input.text ?? "").trim() || undefined;
    type = isImg ? "imagem" : "documento";
    content = caption ?? null;
    payload = isImg
      ? { to, type: "image", image: { link, ...(caption ? { caption } : {}) } }
      : { to, type: "document", document: { link, filename: input.media_filename ?? "documento.pdf", ...(caption ? { caption } : {}) } };
    preview = isImg ? "📷 Imagem" : `📄 ${input.media_filename ?? "Documento"}`;
  } else {
    const tpl = await deps.repo.getTemplate(input.template_name!, input.language!);
    if (!tpl || approvedForSend([tpl]).length === 0) {
      return { ok: false, code: "template", error: "Template não encontrado ou não aprovado. Sincronize os templates." };
    }
    const vars = templateVariables(tpl.components);
    const hv = input.header_values ?? [];
    const bv = input.body_values ?? [];
    if (!allVariablesFilled(vars, hv, bv)) return { ok: false, code: "template", error: "Preencha todas as variáveis do template." };
    const components = buildSendComponents(hv, bv, vars);
    payload = { to, type: "template", template: { name: tpl.name, language: { code: tpl.language }, ...(components.length ? { components } : {}) } };
    type = "template";
    content = renderTemplateText(tpl.components, hv, bv);
    preview = content.slice(0, 120);
  }

  const conv = existing ?? (await deps.repo.ensureConversation(lead.id));
  const messageId = await deps.repo.insertMessage({
    conversation_id: conv.id,
    lead_id: lead.id,
    direction: "enviada",
    type,
    content,
    media_path: input.kind === "media" ? input.media_path! : null,
    media_mime: input.kind === "media" ? input.media_mime! : null,
    media_filename: input.kind === "media" ? input.media_filename ?? null : null,
    media_size: input.kind === "media" ? input.media_size ?? null : null,
    media_status: input.kind === "media" ? "ok" : null,
    status: "enviando",
    sent_by: sender.userId,
    sent_by_email: sender.email,
    phone_number_id: config.phone_number_id,
  });

  const r = await postToMeta(deps.fetch, config.token, config.phone_number_id, payload);
  if ("message" in r) {
    await deps.repo.markFailed(messageId, r.message);
    return { ok: false, code: "meta", error: r.message, message_id: messageId };
  }

  await deps.repo.markSent(messageId, r.wamid);
  await deps.repo.touchConversation(conv.id, preview, now.toISOString());
  await deps.repo.touchLead(lead.id, now.toISOString().slice(0, 10));
  return { ok: true, message_id: messageId, wamid: r.wamid };
}
