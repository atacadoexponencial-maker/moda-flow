// Templates do WhatsApp (S2-03 e envio na S2-04). Módulo puro: usado pela Edge
// Function de sincronização, pela de envio e pela tela.
// Base: crm-exponencial src/lib/templates-da-meta*.ts (com paginação).
import { GRAPH, type FetchLike } from "./whatsapp-graph.ts";

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string | null;
  status: string;
  rejected_reason: string | null;
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: string; // HEADER | BODY | FOOTER | BUTTONS
  format?: string; // TEXT | IMAGE | VIDEO | DOCUMENT | LOCATION
  text?: string;
  buttons?: Array<{ type: string; text?: string; url?: string }>;
}

export type ListResult = { ok: true; templates: MetaTemplate[] } | { ok: false; error: string };

const FIELDS = "id,name,status,category,language,rejected_reason,components";

/** Lista todos os templates da WABA, seguindo `paging.next`. */
export async function listAllTemplates(fetchFn: FetchLike, token: string, wabaId: string): Promise<ListResult> {
  const out: MetaTemplate[] = [];
  let url: string | null = `${GRAPH}/${encodeURIComponent(wabaId)}/message_templates?fields=${FIELDS}&limit=100`;
  for (let page = 0; url && page < 50; page++) {
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await res.json().catch(() => ({}))) as {
      data?: Array<Record<string, unknown>>;
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!res.ok || body.error) return { ok: false, error: body.error?.message ?? `Erro ${res.status} ao listar templates` };
    for (const t of body.data ?? []) {
      out.push({
        id: String(t.id),
        name: String(t.name),
        language: String(t.language),
        category: (t.category as string) ?? null,
        status: String(t.status),
        rejected_reason: (t.rejected_reason as string) && t.rejected_reason !== "NONE" ? String(t.rejected_reason) : null,
        components: (t.components as TemplateComponent[]) ?? [],
      });
    }
    url = body.paging?.next ?? null;
  }
  return { ok: true, templates: out };
}

export interface TemplateStore {
  replaceAll(templates: MetaTemplate[]): Promise<void>;
}

/** Sincroniza: a cópia local passa a ser exatamente a lista da Meta. */
export async function syncTemplates(deps: { fetch: FetchLike; token: string; wabaId: string; store: TemplateStore }) {
  const r = await listAllTemplates(deps.fetch, deps.token, deps.wabaId);
  if ("error" in r) return { ok: false as const, error: r.error };
  await deps.store.replaceAll(r.templates);
  return { ok: true as const, count: r.templates.length };
}

// ------------------------------------------------------------------
// Partes e variáveis
// ------------------------------------------------------------------

export interface TemplateParts {
  headerText: string | null;
  headerFormat: string | null;
  body: string;
  footer: string | null;
  buttons: Array<{ type: string; text?: string }>;
}

export function templateParts(components: TemplateComponent[] | null | undefined): TemplateParts {
  const c = components ?? [];
  const header = c.find((x) => x.type?.toUpperCase() === "HEADER");
  const body = c.find((x) => x.type?.toUpperCase() === "BODY");
  const footer = c.find((x) => x.type?.toUpperCase() === "FOOTER");
  const buttons = c.find((x) => x.type?.toUpperCase() === "BUTTONS");
  return {
    headerText: header?.format?.toUpperCase() === "TEXT" ? header.text ?? null : null,
    headerFormat: header?.format?.toUpperCase() ?? null,
    body: body?.text ?? "",
    footer: footer?.text ?? null,
    buttons: (buttons?.buttons ?? []).map((b) => ({ type: b.type, text: b.text })),
  };
}

/** Maior índice {{n}} usado no texto (a Meta exige valores de 1..n). */
export function variableCount(text: string | null | undefined): number {
  let max = 0;
  for (const m of (text ?? "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

export interface TemplateVariables {
  header: number;
  body: number;
}

export function templateVariables(components: TemplateComponent[] | null | undefined): TemplateVariables {
  const p = templateParts(components);
  return { header: variableCount(p.headerText), body: variableCount(p.body) };
}

/** Limpa o valor como a Meta exige (sem quebra de linha/tab, sem 4+ espaços seguidos). */
export function sanitizeVariable(v: string): string {
  return v.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
}

/** Substitui {{n}} pelos valores (n começa em 1). Faltando valor, mantém o marcador. */
export function fillTemplate(text: string | null | undefined, values: string[]): string {
  return (text ?? "").replace(/\{\{\s*(\d+)\s*\}\}/g, (all, n) => {
    const v = values[Number(n) - 1];
    return v != null && sanitizeVariable(v) !== "" ? sanitizeVariable(v) : all;
  });
}

/** Todas as variáveis exigidas preenchidas? */
export function allVariablesFilled(vars: TemplateVariables, headerValues: string[], bodyValues: string[]): boolean {
  const ok = (n: number, vals: string[]) => Array.from({ length: n }, (_, i) => sanitizeVariable(vals[i] ?? "") !== "").every(Boolean);
  return ok(vars.header, headerValues) && ok(vars.body, bodyValues);
}

/** Texto final (cabeçalho + corpo + rodapé) para o balão e a prévia. */
export function renderTemplateText(components: TemplateComponent[] | null | undefined, headerValues: string[], bodyValues: string[]): string {
  const p = templateParts(components);
  return [p.headerText ? fillTemplate(p.headerText, headerValues) : null, fillTemplate(p.body, bodyValues), p.footer]
    .filter((x) => x && x.trim())
    .join("\n\n");
}

export interface TemplateLike {
  name: string;
  language: string;
  status: string;
  category: string | null;
  components: TemplateComponent[] | unknown;
}

/** Só aprovados entram no seletor de envio (autenticação fica de fora). */
export function approvedForSend<T extends TemplateLike>(templates: T[]): T[] {
  return templates
    .filter((t) => t.status?.toUpperCase() === "APPROVED" && (t.category ?? "").toUpperCase() !== "AUTHENTICATION")
    .sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
}

/** Componentes do envio (`template.components`) a partir dos valores preenchidos. */
export function buildSendComponents(headerValues: string[], bodyValues: string[], vars: TemplateVariables) {
  const comps: Array<{ type: string; parameters: Array<{ type: "text"; text: string }> }> = [];
  if (vars.header > 0) comps.push({ type: "header", parameters: headerValues.slice(0, vars.header).map((v) => ({ type: "text", text: sanitizeVariable(v) })) });
  if (vars.body > 0) comps.push({ type: "body", parameters: bodyValues.slice(0, vars.body).map((v) => ({ type: "text", text: sanitizeVariable(v) })) });
  return comps;
}

export const TEMPLATE_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprovado",
  PENDING: "Em análise",
  REJECTED: "Reprovado",
  PAUSED: "Pausado",
  DISABLED: "Desativado",
  IN_APPEAL: "Em recurso",
  PENDING_DELETION: "Excluindo",
};

export const TEMPLATE_CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};
