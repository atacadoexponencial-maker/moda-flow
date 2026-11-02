import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, Send, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { TemplatePicker, type PickerTemplate, type TemplateSendPayload } from "@/components/whatsapp/TemplatePicker";
import { OUT_ACCEPT, validateOutboundFile, type WindowState, composerMode } from "@/lib/whatsapp-chat";

interface Props {
  window: WindowState;
  templates: PickerTemplate[];
  suggestions?: string[];
  sending: boolean;
  onSendText: (text: string) => void;
  onSendFile: (file: File, caption: string) => void;
  onSendTemplate: (payload: TemplateSendPayload) => void;
}

/** Caixa de envio: texto/anexo com a janela aberta; só template com ela fechada (S2-05). */
export function Composer({ window: w, templates, suggestions, sending, onSendText, onSendFile, onSendTemplate }: Props) {
  const mode = composerMode(w);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    const err = validateOutboundFile(f);
    if (err) { toast.error(`${f.name}: ${err}`); return; }
    setFile(f);
  };

  const submit = () => {
    if (sending) return;
    if (file) { onSendFile(file, text.trim()); setFile(null); setText(""); return; }
    if (text.trim()) { onSendText(text.trim()); setText(""); }
  };

  if (mode === "template" || showTemplates) {
    return (
      <div className="space-y-2 border-t pt-3" data-testid="composer-template">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {mode === "template" ? "Fora da janela de 24 horas: só é possível enviar um template aprovado." : "Enviar template"}
          </p>
          {mode === "livre" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowTemplates(false)}>
              Voltar ao texto
            </Button>
          )}
        </div>
        <TemplatePicker templates={templates} suggestions={suggestions} sending={sending} onSend={onSendTemplate} />
      </div>
    );
  }

  return (
    <div
      className="space-y-2 border-t pt-3"
      data-testid="composer-livre"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
    >
      {file && (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
          <FileText className="h-3 w-3" />
          <span className="max-w-[200px] truncate">{file.name}</span>
          <button type="button" aria-label="Remover arquivo" onClick={() => setFile(null)}>
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Mensagem"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={file ? "Legenda (opcional)" : "Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"}
          className="min-h-[40px] max-h-40 text-sm resize-none"
          rows={1}
        />
        <input ref={inputRef} type="file" accept={OUT_ACCEPT} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Anexar imagem ou PDF" onClick={() => inputRef.current?.click()} disabled={sending}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" className="h-10 w-10 shrink-0" onClick={submit} disabled={sending || (!text.trim() && !file)} aria-label="Enviar">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" onClick={() => setShowTemplates(true)}>
        Enviar template
      </button>
    </div>
  );
}
