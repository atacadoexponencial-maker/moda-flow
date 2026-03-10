import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  const brMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2,'0')}-${brMatch[1].padStart(2,'0')}`;
  const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const clickupMatch = cleaned.match(/(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+)?([a-z]+)\s+(\d{1,2})\s+(\d{4})/i);
  if (clickupMatch && months[clickupMatch[1].toLowerCase()]) {
    return `${clickupMatch[3]}-${months[clickupMatch[1].toLowerCase()]}-${clickupMatch[2].padStart(2,'0')}`;
  }
  const enMatch = cleaned.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (enMatch && months[enMatch[1].toLowerCase()]) return `${enMatch[3]}-${months[enMatch[1].toLowerCase()]}-${enMatch[2].padStart(2,'0')}`;
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

// Column indices based on the ClickUp CSV header
// 0: Task ID, 1: Task Name, 6: Status, 7: Date Created,
// 8: Último contato, 9: Próximo contato, 10: RA (date), 11: Produto, 12: Funil,
// 13: MQL, 14: SQL, 15: RA (emoji), 16: RR (emoji), 17: Faturamento Mensal,
// 18: Oportunidade, 19: Arrecadado, 20: Loss, 21: Nome, 22: E-mail,
// 23: Whatsapp, 24: Instagram, 25: Justificativa, 26: Objetivo,
// 27: Comment Count, 28-32: UTMs

const BOOL_FIELDS = new Set(["mql", "sql_flag", "ra_flag", "rr_flag"]);
const NUM_FIELDS = new Set(["oportunidade", "arrecadado"]);
const DATE_FIELDS = new Set(["data_criada", "data_ultimo_contato", "data_proximo_contato", "data_ra"]);

interface FieldMapping {
  csvIndex: number;
  dbField: string;
}

function getAutoMapping(headers: string[]): FieldMapping[] {
  const normalizeHeader = (raw: string): string => {
    return raw
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2702}-\u{27B0}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}-\u{23F3}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}]/gu, "")
      .replace(/\(.*?\)/g, "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
  };

  const getHint = (raw: string): string | null => {
    const m = raw.match(/\(([^)]+)\)\s*$/);
    return m ? m[1].toLowerCase().trim() : null;
  };

  const mappings: FieldMapping[] = [];

  for (let i = 0; i < headers.length; i++) {
    const raw = headers[i];
    const norm = normalizeHeader(raw);
    const hint = getHint(raw);
    let field = "__skip__";

    if (norm.includes("task name") || norm === "task name") field = "nome";
    else if (norm.includes("nome") || norm === "name") field = "nome";
    else if (norm.includes("e-mail") || norm.includes("email")) field = "email";
    else if (norm.includes("whatsapp") || norm.includes("telefone") || norm.includes("phone")) field = "whatsapp";
    else if (norm.includes("instagram")) field = "instagram";
    else if (norm.includes("status") || norm === "status") field = "status";
    else if (norm.includes("faturamento")) field = "faturamento_mensal";
    else if (norm.includes("oportunidade") || norm.includes("opportunity")) field = "oportunidade";
    else if (norm.includes("arrecadado")) field = "arrecadado";
    else if (norm.includes("justificativa")) field = "justificativa";
    else if (norm.includes("objetivo")) field = "objetivo";
    else if (norm.includes("utm_source") || norm === "source") field = "utm_source";
    else if (norm.includes("utm_medium") || norm === "medium") field = "utm_medium";
    else if (norm.includes("utm_content") || norm === "content") field = "utm_content";
    else if (norm.includes("utm") && (norm.includes("campaign") || norm.includes("campaing"))) field = "utm_campaign";
    else if (norm.includes("utm_posicion") || norm.includes("posicion")) field = "utm_posicion";
    else if (norm.includes("ultimo contato") || norm.includes("last contact")) field = "data_ultimo_contato";
    else if (norm.includes("proximo contato") || norm.includes("next contact")) field = "data_proximo_contato";
    else if (norm.includes("date created") || norm.includes("data criada") || norm.includes("data de entrada")) field = "data_criada";
    else if (norm.includes("funil") || norm.includes("funnel")) field = "funil";
    else if (norm.includes("produto") || norm.includes("product")) field = "produto";
    else if (norm.includes("loss")) field = "loss_reason";
    else if (norm === "ra" || norm === "ra") {
      if (hint === "date") field = "data_ra";
      else if (hint === "emoji") field = "ra_flag";
    }
    else if (norm === "mql" || norm.includes("mql")) {
      field = "mql";
    }
    else if (norm === "sql" || norm.includes("sql")) {
      field = "sql_flag";
    }
    else if (norm === "rr" || norm.includes("rr")) {
      if (hint === "emoji") field = "rr_flag";
    }

    if (field !== "__skip__") {
      mappings.push({ csvIndex: i, dbField: field });
    }
  }

  return mappings;
}

function buildRecord(row: string[], mappings: FieldMapping[]): Record<string, unknown> | null {
  const record: Record<string, unknown> = {};

  for (const { csvIndex, dbField } of mappings) {
    const raw = row[csvIndex]?.trim() ?? "";

    if (dbField === "status") {
      record[dbField] = normalizeStatus(raw);
    } else if (BOOL_FIELDS.has(dbField)) {
      record[dbField] = raw === "1" || raw.toLowerCase() === "true";
    } else if (NUM_FIELDS.has(dbField)) {
      const cleaned = raw.replace(/[R$\s.]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      record[dbField] = isNaN(num) ? 0 : num;
    } else if (DATE_FIELDS.has(dbField)) {
      record[dbField] = parseDate(raw);
    } else {
      // Don't overwrite non-empty with empty (Task Name → Nome fallback)
      if (raw || !record[dbField]) {
        record[dbField] = raw || null;
      }
    }
  }

  if (!record.nome) return null;
  if (!record.status) record.status = "leads_entrada";
  if (record.data_criada) {
    record.created_at = `${record.data_criada}T00:00:00Z`;
  }
  return record;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const csvText = await req.text();
    if (!csvText) {
      return new Response(JSON.stringify({ error: "No CSV data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { headers, rows } = parseCSV(csvText);
    const mappings = getAutoMapping(headers);

    let success = 0;
    let errors = 0;
    const batch = 50;

    for (let i = 0; i < rows.length; i += batch) {
      const chunk = rows.slice(i, i + batch);
      const records = chunk.map(r => buildRecord(r, mappings)).filter(Boolean);
      if (records.length) {
        const { error } = await supabase.from("leads").insert(records as any[]);
        if (error) {
          console.error(`Batch error at ${i}:`, error.message);
          errors += chunk.length;
        } else {
          success += records.length;
          errors += chunk.length - records.length;
        }
      } else {
        errors += chunk.length;
      }
    }

    return new Response(JSON.stringify({ success, errors, totalRows: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Import error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
