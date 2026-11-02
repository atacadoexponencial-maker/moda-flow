// Regras de exibição da conversa do WhatsApp (S2-05/S2-06). A janela de 24h
// vem do módulo compartilhado com o backend.
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { windowState, type WindowState } from "../../supabase/functions/_shared/whatsapp-window";

export { windowState };
export type { WindowState };

export interface ChatMessage {
  id: string;
  direction: "recebida" | "enviada";
  type: string;
  content: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_filename: string | null;
  media_status: string | null;
  status: string | null;
  status_error: string | null;
  reaction_emoji: string | null;
  reply_to_wamid: string | null;
  wamid: string | null;
  sent_by_email: string | null;
  created_at: string;
}

export function dayLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

/** Mensagens agrupadas por dia, em ordem cronológica. */
export function groupByDay<T extends { created_at: string }>(messages: T[]): Array<{ day: string; label: string; items: T[] }> {
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const groups: Array<{ day: string; label: string; items: T[] }> = [];
  for (const m of sorted) {
    const day = format(parseISO(m.created_at), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, label: dayLabel(m.created_at), items: [m] });
  }
  return groups;
}

/** Insere ou substitui (por id) uma mensagem recebida em tempo real. */
export function upsertMessage<T extends { id: string }>(list: T[], m: T): T[] {
  const i = list.findIndex((x) => x.id === m.id);
  if (i === -1) return [...list, m];
  const next = [...list];
  next[i] = { ...next[i], ...m };
  return next;
}

/** Com a janela fechada (ou sem conversa), a caixa de texto livre fica bloqueada e só sai template. */
export function composerMode(w: WindowState): "livre" | "template" {
  return w.open ? "livre" : "template";
}

export function windowLabel(w: WindowState): string {
  if (!w.open || !w.closesAt) return "Fechada: envie um template";
  const closes = parseISO(w.closesAt);
  return `Aberta até ${format(closes, isToday(closes) ? "HH:mm" : "dd/MM HH:mm", { locale: ptBR })}`;
}

export const STATUS_LABEL: Record<string, string> = {
  enviando: "Enviando",
  enviado: "Enviada",
  entregue: "Entregue",
  lido: "Lida",
  falhou: "Falhou",
};

/** Caminho de envio de mídia no bucket (o mesmo das recebidas, numa pasta de saída). */
export function outboundMediaPath(leadId: string, fileName: string, nonce: string): string {
  const ext = (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${leadId}/out/${nonce}.${ext}`;
}

export const OUT_ACCEPT = "image/jpeg,image/png,application/pdf";
export const MAX_OUT_IMAGE = 5 * 1024 * 1024;
export const MAX_OUT_PDF = 16 * 1024 * 1024;

export function validateOutboundFile(f: { type: string; size: number }): string | null {
  if (f.type === "image/jpeg" || f.type === "image/png") return f.size <= MAX_OUT_IMAGE ? null : "Imagem acima de 5 MB.";
  if (f.type === "application/pdf") return f.size <= MAX_OUT_PDF ? null : "PDF acima de 16 MB.";
  return "Envie imagem JPG/PNG ou PDF.";
}
