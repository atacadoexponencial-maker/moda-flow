// Recebimento do webhook do WhatsApp Cloud API (S2-02). Módulo puro: sem Deno,
// sem banco. Usa Web Crypto (globalThis.crypto.subtle), disponível em Deno e no
// Node dos testes. Referência: docs/referencia/porte-whatsapp-crm-exponencial.md §2.

export type InboundType =
  | "texto" | "imagem" | "video" | "audio" | "documento" | "figurinha"
  | "localizacao" | "contato" | "reacao" | "desconhecido";

export interface InboundMedia {
  id: string;
  mime_type: string | null;
  filename: string | null;
}

export interface InboundMessage {
  phone_number_id: string;
  from: string;
  profile_name: string | null;
  wamid: string;
  type: InboundType;
  content: string | null;
  media: InboundMedia | null;
  reply_to_wamid: string | null;
  timestamp: string; // ISO
  preview: string;
}

export type OutboundStatus = "enviado" | "entregue" | "lido" | "falhou";

export interface StatusUpdate {
  phone_number_id: string;
  wamid: string;
  status: OutboundStatus;
  error_code: number | null;
  error_title: string | null;
}

export interface ParsedWebhook {
  messages: InboundMessage[];
  statuses: StatusUpdate[];
  ignored: number; // eventos de outro número
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 hex do corpo bruto (formato do header X-Hub-Signature-256 sem o prefixo). */
export async function signBody(secret: string, rawBody: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
}

/** Confere `X-Hub-Signature-256: sha256=<hex>` contra o corpo bruto. */
export async function verifySignature(rawBody: string, header: string | null, secret: string | null | undefined): Promise<boolean> {
  if (!header || !secret) return false;
  const received = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = await signBody(secret, rawBody);
  return timingSafeEqual(received.toLowerCase(), expected);
}

const PREVIEWS: Record<InboundType, string> = {
  texto: "",
  imagem: "📷 Imagem",
  video: "🎬 Vídeo",
  audio: "🎤 Áudio",
  documento: "📄 Documento",
  figurinha: "Figurinha",
  localizacao: "📍 Localização",
  contato: "👤 Contato",
  reacao: "",
  desconhecido: "Mensagem não suportada",
};

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function mediaOf(m: Raw, key: string): InboundMedia | null {
  const x = m[key];
  if (!x?.id) return null;
  return { id: String(x.id), mime_type: x.mime_type ?? null, filename: x.filename ?? null };
}

/** Converte uma mensagem da Meta no formato do CRM. */
export function toInbound(m: Raw, phoneNumberId: string, profileName: string | null): InboundMessage {
  let type: InboundType = "desconhecido";
  let content: string | null = null;
  let media: InboundMedia | null = null;
  let reply: string | null = m.context?.id ?? null;

  switch (m.type) {
    case "text":
      type = "texto"; content = m.text?.body ?? ""; break;
    case "button":
      type = "texto"; content = m.button?.text ?? ""; break;
    case "interactive":
      type = "texto";
      content = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
      break;
    case "image":
      type = "imagem"; media = mediaOf(m, "image"); content = m.image?.caption ?? null; break;
    case "video":
      type = "video"; media = mediaOf(m, "video"); content = m.video?.caption ?? null; break;
    case "audio":
      type = "audio"; media = mediaOf(m, "audio"); break;
    case "document":
      type = "documento"; media = mediaOf(m, "document"); content = m.document?.caption ?? null; break;
    case "sticker":
      type = "figurinha"; media = mediaOf(m, "sticker"); break;
    case "location": {
      type = "localizacao";
      const l = m.location ?? {};
      const label = [l.name, l.address].filter(Boolean).join(" — ");
      const link = l.latitude != null && l.longitude != null ? `https://maps.google.com/?q=${l.latitude},${l.longitude}` : "";
      content = [label, link].filter(Boolean).join("\n");
      break;
    }
    case "contacts": {
      type = "contato";
      content = (m.contacts ?? [])
        .map((c: Raw) => [c.name?.formatted_name, ...(c.phones ?? []).map((p: Raw) => p.phone)].filter(Boolean).join(" · "))
        .join("\n");
      break;
    }
    case "reaction":
      type = "reacao"; content = m.reaction?.emoji ?? ""; reply = m.reaction?.message_id ?? null; break;
    default:
      type = "desconhecido"; content = null;
  }

  const ts = Number(m.timestamp);
  const timestamp = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString();
  const preview = type === "texto" ? (content ?? "").slice(0, 120) : PREVIEWS[type] + (content && type !== "localizacao" && type !== "contato" ? ` ${content}`.slice(0, 80) : "");

  return {
    phone_number_id: phoneNumberId,
    from: String(m.from ?? ""),
    profile_name: profileName,
    wamid: String(m.id ?? ""),
    type,
    content,
    media,
    reply_to_wamid: reply,
    timestamp,
    preview: preview.trim(),
  };
}

const STATUS_MAP: Record<string, OutboundStatus> = {
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "falhou",
};

/**
 * Extrai mensagens e status do payload, aceitando só o número configurado
 * (o mesmo número pode estar assinado por outro app em testes — SUP-S2-07).
 */
export function parseWebhook(payload: unknown, configuredPhoneNumberId: string | null): ParsedWebhook {
  const out: ParsedWebhook = { messages: [], statuses: [], ignored: 0 };
  const p = (payload ?? {}) as Raw;
  if (p.object !== "whatsapp_business_account") return out;

  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const v = change.value ?? {};
      const phoneId = v.metadata?.phone_number_id ? String(v.metadata.phone_number_id) : null;
      if (!phoneId || !configuredPhoneNumberId || phoneId !== configuredPhoneNumberId) {
        out.ignored += (v.messages?.length ?? 0) + (v.statuses?.length ?? 0);
        continue;
      }
      const names = new Map<string, string>();
      for (const c of v.contacts ?? []) {
        if (c.wa_id && c.profile?.name) names.set(String(c.wa_id), String(c.profile.name));
      }
      for (const m of v.messages ?? []) {
        if (!m?.id || !m?.from) continue;
        out.messages.push(toInbound(m, phoneId, names.get(String(m.from)) ?? null));
      }
      for (const s of v.statuses ?? []) {
        const status = STATUS_MAP[s.status];
        if (!status || !s.id) continue;
        const err = (s.errors ?? [])[0];
        out.statuses.push({
          phone_number_id: phoneId,
          wamid: String(s.id),
          status,
          error_code: err?.code ?? null,
          error_title: err?.title ?? err?.message ?? null,
        });
      }
    }
  }
  return out;
}
