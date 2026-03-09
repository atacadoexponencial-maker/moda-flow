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
  { value: "__skip__", label: "— Ignorar —" },
  { value: "nome", label: "Nome" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "status", label: "Status" },
  { value: "faturamento_mensal", label: "Faturamento Mensal" },
  { value: "oportunidade", label: "Oportunidade" },
  { value: "arrecadado", label: "Arrecadado" },
  { value: "justificativa", label: "Justificativa" },
  { value: "objetivo", label: "Objetivo" },
  { value: "utm_source", label: "utm_source" },
  { value: "utm_medium", label: "utm_medium" },
  { value: "utm_content", label: "utm_content" },
  { value: "utm_campaign", label: "utm_campaign" },
  { value: "data_ultimo_contato", label: "Último Contato" },
  { value: "data_proximo_contato", label: "Próximo Contato" },
  { value: "data_ra", label: "RA (data)" },
  { value: "data_criada", label: "Data de Entrada" },
  { value: "mql", label: "MQL" },
  { value: "sql_flag", label: "SQL" },
  { value: "ra_flag", label: "RA (flag)" },
  { value: "rr_flag", label: "RR (flag)" },
] as const;

const AUTO_MAP: Record<string, string> = {
  "nome (short text)": "nome",
  "e-mail (short text)": "email",
  "whatsapp (phone)": "whatsapp",
  "instagram (short text)": "instagram",
  "status": "status",
  "faturamento mensal (short text)": "faturamento_mensal",
  "oportunidade (currency)": "oportunidade",
  "arrecadado (currency)": "arrecadado",
  "justificativa (short text)": "justificativa",
  "objetivo 2025 (short text)": "objetivo",
  "utm_source (short text)": "utm_source",
  "utm_medium (short text)": "utm_medium",
  "utm_content (short text)": "utm_content",
  "utm-campaing (short text)": "utm_campaign",
  "último contato (date)": "data_ultimo_contato",
  "próximo contato (date)": "data_proximo_contato",
  "ra (date)": "data_ra",
  "mql (emoji)": "mql",
  "sql (emoji)": "sql_flag",
  "ra (emoji)": "ra_flag",
  "rr (emoji)": "rr_flag",
};

const BOOL_FIELDS = new Set(["mql", "sql_flag", "ra_flag", "rr_flag"]);
const NUM_FIELDS = new Set(["oportunidade", "arrecadado"]);

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
    if (BOOL_FIELDS.has(field)) {
      record[field] = raw === "1" || raw.toLowerCase() === "true";
    } else if (NUM_FIELDS.has(field)) {
      const cleaned = raw.replace(/[R$\s.]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      record[field] = isNaN(num) ? 0 : num;
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
