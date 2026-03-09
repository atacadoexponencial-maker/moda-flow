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

const AUTO_MAP: Record<string, string> = {
  "nome (short text)": "nome",
  "nome": "nome",
  "e-mail (short text)": "email",
  "e-mail": "email",
  "email": "email",
  "whatsapp (phone)": "whatsapp",
  "whatsapp": "whatsapp",
  "instagram (short text)": "instagram",
  "instagram": "instagram",
  "status": "status",
  "faturamento mensal (short text)": "faturamento_mensal",
  "faturamento mensal": "faturamento_mensal",
  "oportunidade (currency)": "oportunidade",
  "oportunidade": "oportunidade",
  "arrecadado (currency)": "arrecadado",
  "arrecadado": "arrecadado",
  "justificativa (short text)": "justificativa",
  "justificativa": "justificativa",
  "objetivo 2025 (short text)": "objetivo",
  "objetivo": "objetivo",
  "utm_source (short text)": "utm_source",
  "utm_source": "utm_source",
  "utm_medium (short text)": "utm_medium",
  "utm_medium": "utm_medium",
  "utm_content (short text)": "utm_content",
  "utm_content": "utm_content",
  "utm-campaing (short text)": "utm_campaign",
  "utm_campaign (short text)": "utm_campaign",
  "utm_campaign": "utm_campaign",
  "utm_posicion (short text)": "utm_posicion",
  "utm_posicion": "utm_posicion",
  "último contato (date)": "data_ultimo_contato",
  "próximo contato (date)": "data_proximo_contato",
  "ra (date)": "data_ra",
  "mql (emoji)": "mql",
  "sql (emoji)": "sql_flag",
  "ra (emoji)": "ra_flag",
  "rr (emoji)": "rr_flag",
  "date created": "data_criada",
  "data de criação": "data_criada",
  "data criada": "data_criada",
  "funil (short text)": "funil",
  "funil": "funil",
  "produto (short text)": "produto",
  "produto": "produto",
  "loss reason (short text)": "loss_reason",
  "loss reason": "loss_reason",
  "motivo de perda": "loss_reason",
};

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
  "desqualificado": "desqualificado",
  "proposta recusada": "proposta_recusada",
  "proposta_recusada": "proposta_recusada",
  "contrato assinado": "contrato_assinado",
  "contrato_assinado": "contrato_assinado",
};

function normalizeStatus(raw: string): string {
  const key = raw.toLowerCase().trim();
  return STATUS_NORMALIZE[key] ?? "leads_entrada";
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // DD/MM/YYYY
  const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2,'0')}-${brMatch[1].padStart(2,'0')}`;
  // YYYY-MM-DD (with optional time)
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  // MM/DD/YYYY
  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch && Number(usMatch[1]) > 12) return `${usMatch[3]}-${usMatch[1].padStart(2,'0')}-${usMatch[2].padStart(2,'0')}`;
  // "Month DD, YYYY" or "DD Month YYYY"
  const months: Record<string, string> = { january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',janeiro:'01',fevereiro:'02',março:'03',abril:'04',maio:'05',junho:'06',julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12' };
  const enMatch = raw.match(/^([a-zA-Zçã]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (enMatch && months[enMatch[1].toLowerCase()]) return `${enMatch[3]}-${months[enMatch[1].toLowerCase()]}-${enMatch[2].padStart(2,'0')}`;
  const ptMatch = raw.match(/^(\d{1,2})\s+de\s+([a-zA-Zçã]+)\s+de\s+(\d{4})$/i);
  if (ptMatch && months[ptMatch[2].toLowerCase()]) return `${ptMatch[3]}-${months[ptMatch[2].toLowerCase()]}-${ptMatch[1].padStart(2,'0')}`;
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
        const key = col.toLowerCase().trim();
        autoMap[i] = AUTO_MAP[key] ?? "__skip__";
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
