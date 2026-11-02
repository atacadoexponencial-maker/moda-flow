import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, CheckCheck, Clock, AlertTriangle, FileText, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLeadConversation } from "@/hooks/useLeadConversation";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { Composer } from "@/components/whatsapp/Composer";
import type { TemplateSendPayload } from "@/components/whatsapp/TemplatePicker";
import { getErrorMessage } from "@/lib/utils";
import {
  groupByDay,
  windowState,
  windowLabel,
  outboundMediaPath,
  STATUS_LABEL,
  type ChatMessage,
} from "@/lib/whatsapp-chat";

function StatusIcon({ status }: { status: string | null }) {
  const cls = "h-3 w-3";
  switch (status) {
    case "enviando": return <Clock className={cls} aria-label="Enviando" />;
    case "enviado": return <Check className={cls} aria-label="Enviada" />;
    case "entregue": return <CheckCheck className={cls} aria-label="Entregue" />;
    case "lido": return <CheckCheck className={`${cls} text-sky-500`} aria-label="Lida" />;
    case "falhou": return <AlertTriangle className={`${cls} text-destructive`} aria-label="Falhou" />;
    default: return null;
  }
}

function MediaBlock({ m, url, onZoom }: { m: ChatMessage; url?: string; onZoom: (u: string) => void }) {
  if (m.media_status === "grande_demais") return <p className="text-xs italic opacity-80">Arquivo grande demais para guardar no CRM.</p>;
  if (m.media_status === "falhou") return <p className="text-xs italic opacity-80">Não foi possível carregar o arquivo.</p>;
  if (!m.media_path) return m.media_status === "pendente" ? <p className="text-xs italic opacity-80">Carregando arquivo…</p> : null;
  if (!url) return <p className="text-xs italic opacity-80">…</p>;
  if (m.type === "imagem" || m.type === "figurinha") {
    return (
      <button type="button" onClick={() => onZoom(url)} className={m.type === "figurinha" ? "block h-24 w-24" : "block max-w-[240px]"}>
        <img src={url} alt="Imagem recebida" className="rounded-md max-h-64 object-cover" />
      </button>
    );
  }
  if (m.type === "audio") return <audio controls src={url} className="max-w-[240px]" />;
  if (m.type === "video") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
        Baixar vídeo
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded border bg-background/60 px-2 py-1 text-xs">
      <FileText className="h-3.5 w-3.5" />
      <span className="max-w-[200px] truncate">{m.media_filename ?? "Documento"}</span>
    </a>
  );
}

function Bubble({ m, url, onZoom }: { m: ChatMessage; url?: string; onZoom: (u: string) => void }) {
  const out = m.direction === "enviada";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] rounded-lg px-3 py-1.5 text-sm space-y-1 ${
          out ? "bg-primary/10 text-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {m.type === "template" && <Badge variant="outline" className="text-[9px] px-1 py-0">Template</Badge>}
        {m.media_status || m.media_path ? <MediaBlock m={m} url={url} onZoom={onZoom} /> : null}
        {m.type === "localizacao" && <MapPin className="h-3.5 w-3.5 inline mr-1" />}
        {m.type === "desconhecido" ? (
          <p className="text-xs italic opacity-80">Mensagem não suportada pelo WhatsApp do CRM.</p>
        ) : (
          m.content && <p className="whitespace-pre-wrap break-words leading-snug">{m.content}</p>
        )}
        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {out && m.sent_by_email && <span className="truncate max-w-[120px]">{m.sent_by_email.split("@")[0]}</span>}
          <span>{format(parseISO(m.created_at), "HH:mm", { locale: ptBR })}</span>
          {out && <StatusIcon status={m.status} />}
        </div>
        {out && m.status === "falhou" && m.status_error && (
          <p className="text-[11px] text-destructive" title={STATUS_LABEL.falhou}>{m.status_error}</p>
        )}
        {m.reaction_emoji && <span className="absolute -bottom-2 right-2 text-xs bg-background rounded-full px-1 shadow-sm">{m.reaction_emoji}</span>}
      </div>
    </div>
  );
}

interface Props {
  leadId: string;
  leadFirstName?: string;
  active: boolean;
  onUnreadChange?: (n: number) => void;
}

/** Conversa do WhatsApp do lead (aba "Conversa" do painel). */
export function LeadConversation({ leadId, leadFirstName, active, onUnreadChange }: Props) {
  const { conversation, messages, mediaUrls, loading, markRead } = useLeadConversation(leadId);
  const { data: templates = [] } = useWhatsAppTemplates();
  const [sending, setSending] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Atualiza o indicador da janela a cada minuto
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Abrir a aba (ou chegar mensagem com ela aberta) zera as não lidas
  const unread = conversation?.unread_count ?? 0;
  useEffect(() => {
    if (active && unread > 0) markRead();
  }, [active, unread, markRead]);

  useEffect(() => {
    onUnreadChange?.(unread);
  }, [unread, onUnreadChange]);

  useEffect(() => {
    if (active) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active, messages.length]);

  const w = useMemo(() => windowState(conversation?.last_inbound_at ?? null, now), [conversation?.last_inbound_at, now]);
  const groups = useMemo(() => groupByDay(messages), [messages]);

  const send = async (body: Record<string, unknown>) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; error?: string }>("whatsapp-send", { body: { lead_id: leadId, ...body } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Não foi possível enviar");
    } catch (e) {
      toast.error(getErrorMessage(e, "Não foi possível enviar"));
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: File, caption: string) => {
    setSending(true);
    const path = outboundMediaPath(leadId, file.name, crypto.randomUUID());
    const up = await supabase.storage.from("whatsapp-media").upload(path, file, { contentType: file.type });
    setSending(false);
    if (up.error) { toast.error("Falha ao enviar o arquivo"); return; }
    await send({ kind: "media", media_path: path, media_mime: file.type, media_filename: file.name, media_size: file.size, text: caption });
  };

  const sendTemplate = (p: TemplateSendPayload) => send({ kind: "template", ...p });

  return (
    <div className="flex flex-col h-full min-h-[50vh]">
      <div className="flex items-center justify-between pb-2">
        <span className={`text-xs ${w.open ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`} data-testid="window-label">
          Janela: {windowLabel(w)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[55vh]">
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma mensagem ainda. A primeira mensagem para este lead precisa ser um template aprovado.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.day} className="space-y-1.5">
              <div className="flex justify-center">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/70 rounded-full px-2 py-0.5">{g.label}</span>
              </div>
              {g.items.map((m) => (
                <Bubble key={m.id} m={m} url={m.media_path ? mediaUrls[m.media_path] : undefined} onZoom={setZoom} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        window={w}
        templates={templates}
        suggestions={leadFirstName ? [leadFirstName] : []}
        sending={sending}
        onSendText={(text) => send({ kind: "text", text })}
        onSendFile={sendFile}
        onSendTemplate={sendTemplate}
      />

      <Dialog open={!!zoom} onOpenChange={(o) => { if (!o) setZoom(null); }}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Imagem</DialogTitle>
          {zoom && <img src={zoom} alt="Imagem ampliada" className="max-h-[80vh] w-full object-contain rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
