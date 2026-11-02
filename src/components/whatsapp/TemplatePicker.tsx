import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import {
  approvedForSend,
  templateVariables,
  allVariablesFilled,
  renderTemplateText,
  type TemplateComponent,
} from "../../../supabase/functions/_shared/whatsapp-templates";

export interface PickerTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string | null;
  components: TemplateComponent[];
}

export interface TemplateSendPayload {
  template_name: string;
  language: string;
  header_values: string[];
  body_values: string[];
}

interface Props {
  templates: PickerTemplate[];
  sending?: boolean;
  /** Sugestões para as variáveis do corpo (ex.: [primeiro nome do lead]). */
  suggestions?: string[];
  onSend: (payload: TemplateSendPayload) => void;
}

/** Seletor de template com variáveis e prévia do texto final (S2-03; usado no envio). */
export function TemplatePicker({ templates, sending, suggestions = [], onSend }: Props) {
  const approved = useMemo(() => approvedForSend(templates), [templates]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [headerValues, setHeaderValues] = useState<string[]>([]);
  const [bodyValues, setBodyValues] = useState<string[]>([]);

  const selected = approved.find((t) => t.id === selectedId) ?? null;
  const vars = selected ? templateVariables(selected.components) : { header: 0, body: 0 };
  const ready = !!selected && allVariablesFilled(vars, headerValues, bodyValues);
  const preview = selected ? renderTemplateText(selected.components, headerValues, bodyValues) : "";

  const choose = (id: string) => {
    setSelectedId(id);
    const t = approved.find((x) => x.id === id);
    const v = t ? templateVariables(t.components) : { header: 0, body: 0 };
    setHeaderValues(Array.from({ length: v.header }, () => ""));
    setBodyValues(Array.from({ length: v.body }, (_, i) => suggestions[i] ?? ""));
  };

  const setAt = (list: string[], setter: (v: string[]) => void, i: number, value: string) => {
    const next = [...list];
    next[i] = value;
    setter(next);
  };

  if (approved.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum template aprovado. Sincronize em Configurações › WhatsApp.</p>;
  }

  return (
    <div className="space-y-3" data-testid="template-picker">
      <Select value={selectedId} onValueChange={choose}>
        <SelectTrigger className="h-9 text-sm" aria-label="Template">
          <SelectValue placeholder="Escolha um template aprovado" />
        </SelectTrigger>
        <SelectContent>
          {approved.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name} · {t.language}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <>
          {(vars.header > 0 || vars.body > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {headerValues.map((v, i) => (
                <div key={`h${i}`} className="space-y-1">
                  <Label className="text-xs" htmlFor={`tpl-h-${i}`}>{`Cabeçalho {{${i + 1}}}`}</Label>
                  <Input id={`tpl-h-${i}`} className="h-8 text-sm" value={v} onChange={(e) => setAt(headerValues, setHeaderValues, i, e.target.value)} />
                </div>
              ))}
              {bodyValues.map((v, i) => (
                <div key={`b${i}`} className="space-y-1">
                  <Label className="text-xs" htmlFor={`tpl-b-${i}`}>{`Variável {{${i + 1}}}`}</Label>
                  <Input id={`tpl-b-${i}`} className="h-8 text-sm" value={v} onChange={(e) => setAt(bodyValues, setBodyValues, i, e.target.value)} />
                </div>
              ))}
            </div>
          )}
          <div className="rounded-md bg-muted/60 p-2.5 text-sm whitespace-pre-line text-foreground" data-testid="template-preview">
            {preview}
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!ready || sending}
              onClick={() =>
                selected &&
                onSend({ template_name: selected.name, language: selected.language, header_values: headerValues, body_values: bodyValues })
              }
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Enviar template
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
