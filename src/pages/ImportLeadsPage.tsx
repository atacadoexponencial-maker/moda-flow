import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const LEAD_FIELDS = [
  { value: "__skip__", label: "— Ignorar coluna —" },
  { value: "arrecadado", label: "Arrecadado" },
  { value: "data_criada", label: "Data de Entrada" },
  { value: "data_proximo_contato", label: "Próximo Contato" },
  { value: "data_ra", label: "RA (data)" },
  { value: "data_ultimo_contato", label: "Último Contato" },
  { value: "email", label: "E-mail" },
  { value: "faturamento_mensal", label: "Faturamento Mensal" },
  { value: "funil", label: "Funil" },
  { value: "instagram", label: "Instagram" },
  { value: "justificativa", label: "Justificativa" },
  { value: "loss_reason", label: "Motivo de Perda" },
  { value: "mql", label: "MQL" },
  { value: "nome", label: "Nome" },
  { value: "objetivo", label: "Objetivo" },
  { value: "oportunidade", label: "Oportunidade" },
  { value: "produto", label: "Produto" },
  { value: "ra_flag", label: "RA (flag)" },
  { value: "rr_flag", label: "RR (flag)" },
  { value: "sql_flag", label: "SQL" },
  { value: "status", label: "Status" },
  { value: "utm_campaign", label: "utm_campaign" },
  { value: "utm_content", label: "utm_content" },
  { value: "utm_medium", label: "utm_medium" },
  { value: "utm_posicion", label: "utm_posicion" },
  { value: "utm_source", label: "utm_source" },
  { value: "whatsapp", label: "WhatsApp" },
] as const;

const AUTO_MAP: Record<string, string> = {};

function reg(field: string, ...keys: string[]) {
  keys.forEach(k => { AUTO_MAP[k] = field; });
}

reg("nome", "nome", "name", "nome (short text)", "nome do lead", "lead name", "nome completo", "full name", "razão social", "razao social", "empresa", "company", "task name", "task name (short text)");
reg("email", "email", "e-mail", "e-mail (short text)", "email (short text)", "email do lead", "lead email", "correio", "mail");
reg("whatsapp", "whatsapp", "whatsapp (phone)", "whatsapp (short text)", "telefone", "phone", "celular", "tel", "fone", "número", "numero", "mobile");
reg("instagram", "instagram", "instagram (short text)", "ig", "@instagram", "perfil instagram");
reg("status", "status", "status (short text)", "etapa", "stage", "fase", "pipeline stage", "coluna");
reg("faturamento_mensal", "faturamento mensal", "faturamento mensal (short text)", "faturamento", "revenue", "monthly revenue", "receita", "receita mensal", "mrr");
reg("oportunidade", "oportunidade", "oportunidade (currency)", "oportunidade (short text)", "valor", "deal value", "valor do negócio", "valor do negocio", "deal", "opportunity", "valor oportunidade");
reg("arrecadado", "arrecadado", "arrecadado (currency)", "arrecadado (short text)", "valor arrecadado", "receita fechada", "won value", "closed value", "ganho");
reg("justificativa", "justificativa", "justificativa (short text)", "motivo", "reason", "notes", "observação", "observacao", "obs", "nota", "comentário", "comentario");
reg("objetivo", "objetivo", "objetivo (short text)", "objetivo 2025", "objetivo 2025 (short text)", "meta", "goal", "target");
reg("utm_source", "utm_source", "utm_source (short text)", "source", "fonte", "origem", "canal");
reg("utm_medium", "utm_medium", "utm_medium (short text)", "medium", "mídia", "midia");
reg("utm_content", "utm_content", "utm_content (short text)", "content", "conteúdo", "conteudo");
reg("utm_campaign", "utm_campaign", "utm_campaign (short text)", "utm-campaing (short text)", "utm-campaign", "campaign", "campanha");
reg("utm_posicion", "utm_posicion", "utm_posicion (short text)", "posição", "posicao", "position", "ad position");
reg("data_ultimo_contato", "último contato", "último contato (date)", "ultimo contato", "data último contato", "data ultimo contato", "last contact", "last contacted");
reg("data_proximo_contato", "próximo contato", "próximo contato (date)", "proximo contato", "data próximo contato", "data proximo contato", "next contact", "follow-up", "follow up", "followup");
reg("data_ra", "ra (date)", "data ra", "data da reunião", "data da reuniao", "data reunião", "data reuniao", "meeting date");
reg("data_criada", "date created", "data de criação", "data criada", "data de entrada", "data entrada", "criado em", "created at", "created_at", "created", "entrada", "data cadastro", "dt criação", "dt criacao");
reg("mql", "mql", "mql (emoji)", "mql (short text)", "marketing qualified");
reg("sql_flag", "sql", "sql (emoji)", "sql (short text)", "sales qualified");
reg("ra_flag", "ra", "ra (emoji)", "ra (short text)", "reunião agendada", "reuniao agendada");
reg("rr_flag", "rr", "rr (emoji)", "rr (short text)", "reunião realizada", "reuniao realizada");
reg("funil", "funil", "funil (short text)", "funnel", "pipeline");
reg("produto", "produto", "produto (short text)", "product", "serviço", "servico", "plano", "plan");
reg("loss_reason", "loss reason", "loss reason (short text)", "motivo de perda", "motivo perda", "lost reason", "razão de perda", "razao de perda");

/** Extract parenthetical hint from header, e.g. "(date)", "(emoji)", "(short text)" */
function getTypeHint(raw: string): string | null {
  const match = raw.match(/\(([^)]+)\)\s*$/);
  return match ? match[1].toLowerCase().trim() : null;
}

/** Normalize a CSV header for fuzzy matching: strip emoji, parenthetical type hints, accents */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2702}-\u{27B0}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}-\u{23F3}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}]/gu, "") // emoji
    .replace(/\(.*?\)/g, "") // (short text), (date), etc.
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-zA-Z0-9_\- ]/g, "") // special chars
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function autoMapHeader(rawCol: string): string {
  const exact = rawCol.toLowerCase().trim();
  if (AUTO_MAP[exact]) return AUTO_MAP[exact];

  const normalized = normalizeHeader(rawCol);
  const hint = getTypeHint(rawCol);

  // Use type hint to disambiguate (e.g. "RA (date)" vs "RA (emoji)")
  if (normalized === "ra" || normalized === "ra") {
    if (hint === "date") return "data_ra";
    if (hint === "emoji") return "ra_flag";
  }
  if (normalized === "sql") {
    if (hint === "emoji") return "sql_flag";
  }
  if (normalized === "rr") {
    if (hint === "emoji") return "rr_flag";
  }
  if (normalized === "mql") {
    if (hint === "emoji") return "mql";
  }

  if (AUTO_MAP[normalized]) return AUTO_MAP[normalized];

  // Try matching against normalized versions of all keys
  for (const [key, field] of Object.entries(AUTO_MAP)) {
    if (normalizeHeader(key) === normalized) return field;
  }

  // Substring/contains matching for common fields
  const contains: [string, string][] = [
    ["nome", "nome"], ["name", "nome"], ["email", "email"], ["e-mail", "email"],
    ["whatsapp", "whatsapp"], ["telefone", "whatsapp"], ["phone", "whatsapp"],
    ["instagram", "instagram"], ["faturamento", "faturamento_mensal"],
    ["oportunidade", "oportunidade"], ["opportunity", "oportunidade"],
    ["arrecadado", "arrecadado"], ["justificativa", "justificativa"],
    ["objetivo", "objetivo"], ["utm_source", "utm_source"], ["utm_medium", "utm_medium"],
    ["utm_content", "utm_content"], ["utm_campaign", "utm_campaign"], ["utm-campaing", "utm_campaign"],
    ["utm_posicion", "utm_posicion"], ["proximo contato", "data_proximo_contato"],
    ["ultimo contato", "data_ultimo_contato"], ["loss", "loss_reason"],
    ["motivo de perda", "loss_reason"], ["funil", "funil"], ["produto", "produto"],
    ["date created", "data_criada"], ["data criada", "data_criada"],
  ];
  for (const [substr, field] of contains) {
    if (normalized.includes(substr)) return field;
  }

  return "__skip__";
}

const BOOL_FIELDS = new Set(["mql", "sql_flag", "ra_flag", "rr_flag"]);
const NUM_FIELDS = new Set(["oportunidade", "arrecadado"]);
const DATE_FIELDS = new Set(["data_criada", "data_ultimo_contato", "data_proximo_contato", "data_ra"]);

const STATUS_NORMALIZE: Record<string, string> = {
  "leads de entrada": "leads_entrada",
  "leads entrada": "leads_entrada",
  "qualificação": "qualificacao",
  "qualificacao": "qualificacao",
  "follow-up ra": "follow_ra",
  "follow ra": "follow_ra",
  "follow_ra": "follow_ra",
  "reunião": "reuniao",
  "reuniao": "reuniao",
  "proposta/negociação": "proposta_negociacao",
  "proposta negociação": "proposta_negociacao",
  "proposta_negociacao": "proposta_negociacao",
  "follow-up rr": "follow_rr",
  "follow rr": "follow_rr",
  "follow_rr": "follow_rr",
  "follow futuro": "follow_futuro",
  "follow_futuro": "follow_futuro",
  "contrato": "contrato",
  "nutrição": "nutricao",
  "nutricao": "nutricao",
  "nutrição (follow infinito)": "nutricao",
  "nutricao (follow infinito)": "nutricao",
  "desqualificado": "desqualificado",
  "proposta recusada": "proposta_recusada",
  "proposta_recusada": "proposta_recusada",
  "contrato assinado": "contrato_assinado",
  "contrato_assinado": "contrato_assinado",
};

function normalizeStatus(raw: string): string {
  const key = raw.toLowerCase().trim();
  if (STATUS_NORMALIZE[key]) return STATUS_NORMALIZE[key];
  // Fuzzy: check if any known key is contained in the raw value
  for (const [pattern, value] of Object.entries(STATUS_NORMALIZE)) {
    if (key.includes(pattern) || pattern.includes(key)) return value;
  }
  return "leads_entrada";
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const months: Record<string, string> = {
    january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
    july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',
    janeiro:'01',fevereiro:'02',marco:'03',abril:'04',maio:'05',junho:'06',
    julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12',
  };

  // Strip ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/gi, '$1');

  // DD/MM/YYYY
  const brMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2,'0')}-${brMatch[1].padStart(2,'0')}`;

  // YYYY-MM-DD (with optional time)
  const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // ClickUp format: "Weekday, Month DD YYYY, time" or "Weekday, Month DD YYYY"
  const clickupMatch = cleaned.match(/(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+)?([a-z]+)\s+(\d{1,2})\s+(\d{4})/i);
  if (clickupMatch && months[clickupMatch[1].toLowerCase()]) {
    return `${clickupMatch[3]}-${months[clickupMatch[1].toLowerCase()]}-${clickupMatch[2].padStart(2,'0')}`;
  }

  // "Month DD, YYYY"
  const enMatch = cleaned.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (enMatch && months[enMatch[1].toLowerCase()]) return `${enMatch[3]}-${months[enMatch[1].toLowerCase()]}-${enMatch[2].padStart(2,'0')}`;

  // "DD de Month de YYYY"
  const ptMatch = cleaned.match(/^(\d{1,2})\s+de\s+([a-zA-Z]+)\s+de\s+(\d{4})$/i);
  if (ptMatch && months[ptMatch[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")]) {
    const m = ptMatch[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return `${ptMatch[3]}-${months[m]}-${ptMatch[1].padStart(2,'0')}`;
  }

  // Fallback: try native Date
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const parse = (line: string) => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',' || ch === ';') { result.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };
  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse);
  return { headers, rows };
}

function buildRecord(row: string[], headers: string[], mapping: Record<number, string>) {
  const record: Record<string, unknown> = {};
  for (const [idxStr, field] of Object.entries(mapping)) {
    if (field === "__skip__") continue;
    const idx = Number(idxStr);
    const raw = row[idx]?.trim() ?? "";
    if (field === "status") {
      record[field] = normalizeStatus(raw);
    } else if (BOOL_FIELDS.has(field)) {
      record[field] = raw === "1" || raw.toLowerCase() === "true";
    } else if (NUM_FIELDS.has(field)) {
      const cleaned = raw.replace(/[R$\s.]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      record[field] = isNaN(num) ? 0 : num;
    } else if (DATE_FIELDS.has(field)) {
      record[field] = parseDate(raw);
    } else {
      record[field] = raw || null;
    }
  }
  if (!record.nome) return null;
  if (!record.status) record.status = "leads_entrada";
  // Sync created_at with data_criada so the DB timestamp reflects the original date
  if (record.data_criada) {
    record.created_at = `${record.data_criada}T00:00:00Z`;
  }
  return record;
}

export default function ImportLeadsPage() {
  const navigate = useNavigate();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers: h, rows: r } = parseCSV(ev.target?.result as string);
      setHeaders(h);
      setRows(r);
      const autoMap: Record<number, string> = {};
      h.forEach((col, i) => {
        autoMap[i] = autoMapHeader(col);
      });
      setMapping(autoMap);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setResult(null);
    let success = 0;
    let errors = 0;
    const batch = 50;

    for (let i = 0; i < rows.length; i += batch) {
      const chunk = rows.slice(i, i + batch);
      const records = chunk.map(r => buildRecord(r, headers, mapping)).filter(Boolean);
      if (records.length) {
        const { error } = await supabase.from("leads").insert(records as any[]);
        if (error) { errors += chunk.length; } else { success += records.length; errors += chunk.length - records.length; }
      } else {
        errors += chunk.length;
      }
      setProgress(Math.min(100, Math.round(((i + chunk.length) / rows.length) * 100)));
    }

    setImporting(false);
    setProgress(100);
    setResult({ success, errors });
    toast({ title: "Importação concluída", description: `${success} leads importados, ${errors} erros.` });
  };

  const preview = rows.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Importar Leads</h2>
          <p className="text-muted-foreground text-sm">Faça upload de um arquivo CSV para importar leads.</p>
        </div>
      </div>

      {/* Upload */}
      {!headers.length && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Selecione um arquivo CSV</p>
            <label>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <Button asChild variant="default">
                <span><Upload className="h-4 w-4 mr-2" />Escolher arquivo</span>
              </Button>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {headers.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview ({rows.length} linhas no total)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h, i) => <TableHead key={i} className="whitespace-nowrap text-xs">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => <TableCell key={ci} className="text-xs max-w-[200px] truncate">{cell}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapeamento de Colunas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-sm font-medium w-64 truncate text-foreground" title={h}>{h}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select value={mapping[i] ?? "__skip__"} onValueChange={(v) => setMapping(prev => ({ ...prev, [i]: v }))}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Import */}
          <div className="space-y-4">
            {importing && <Progress value={progress} className="h-2" />}
            {result && (
              <p className="text-sm font-medium text-foreground">
                ✅ {result.success} leads importados com sucesso, {result.errors} erros.
              </p>
            )}
            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : "Importar"}
              </Button>
              <Button variant="outline" onClick={() => { setHeaders([]); setRows([]); setMapping({}); setResult(null); }}>
                Limpar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
