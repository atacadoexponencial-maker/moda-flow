// Mapeamento do payload recebido pelo webhook para a linha de `leads`.
// Módulo puro (sem Deno, sem Supabase) para poder ser testado com Vitest.
//
// Regra de leitura: cada chave é procurada primeiro na raiz do payload e, se
// ausente, dentro de `attribution` — objeto que o tracking-avancado envia com
// fbc, gclid, external_id e as UTMs (functions/tracker.js:705-717).

export function mapPayloadToLead(body: Record<string, unknown>): Record<string, unknown> {
  const attribution =
    body.attribution && typeof body.attribution === "object"
      ? (body.attribution as Record<string, unknown>)
      : {};
  const present = (v: unknown) => v !== undefined && v !== null && v !== "";
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (present(body[k])) return body[k];
    }
    for (const k of keys) {
      if (present(attribution[k])) return attribution[k];
    }
    return undefined;
  };

  const record: Record<string, unknown> = {};

  record.nome = get("nome", "name") ?? "Lead";
  record.email = get("email") ?? null;
  record.whatsapp = get("whatsapp", "phone", "telefone") ?? null;
  record.instagram = get("instagram") ?? null;
  record.funil = get("funil", "funnel") ?? null;
  record.produto = get("produto", "product") ?? null;
  record.utm_source = get("utm_source", "source") ?? null;
  record.utm_medium = get("utm_medium", "medium") ?? null;
  record.utm_campaign = get("utm_campaign", "campaign") ?? null;
  record.utm_content = get("utm_content") ?? null;
  record.utm_term = get("utm_term", "term") ?? null;
  record.fbc = get("fbc") ?? null;
  record.gclid = get("gclid") ?? null;
  record.external_id = get("external_id") ?? null;
  record.meta_campaign_id = get("meta_campaign_id", "campaign_id") ?? null;
  record.meta_ad_id = get("meta_ad_id", "ad_id") ?? null;
  record.meta_lead_id = get("meta_lead_id", "leadgen_id") ?? null;
  record.faturamento_mensal = get("faturamento_mensal", "faturamento") ?? null;
  record.justificativa = get("justificativa", "motivo") ?? null;
  record.objetivo = get("objetivo", "meta") ?? null;

  const opValue = get("oportunidade", "valor");
  if (opValue !== undefined) {
    const num = parseFloat(String(opValue).replace(/[R$\s.]/g, "").replace(",", "."));
    record.oportunidade = isNaN(num) ? 0 : num;
  }

  const statusRaw = get("status");
  record.status = statusRaw ? normalizeStatus(String(statusRaw)) : "leads_entrada";

  const dataCriada = get("data_criada");
  if (dataCriada) {
    record.created_at = `${dataCriada}T00:00:00Z`;
  } else {
    record.created_at = new Date().toISOString();
  }

  return record;
}

export const STATUS_MAP: Record<string, string> = {
  "leads_entrada": "leads_entrada",
  "leads de entrada": "leads_entrada",
  "leads entrada": "leads_entrada",
  "qualificacao": "qualificacao",
  "qualificação": "qualificacao",
  "follow_ra": "follow_ra",
  "follow ra": "follow_ra",
  "follow-up ra": "follow_ra",
  "reuniao": "reuniao",
  "reunião": "reuniao",
  "proposta_negociacao": "proposta_negociacao",
  "proposta negociacao": "proposta_negociacao",
  "proposta/negociação": "proposta_negociacao",
  "follow_rr": "follow_rr",
  "follow rr": "follow_rr",
  "follow-up rr": "follow_rr",
  "follow_futuro": "follow_futuro",
  "follow futuro": "follow_futuro",
  "contrato": "contrato",
  "nutricao": "nutricao",
  "nutrição": "nutricao",
  "desqualificado": "desqualificado",
  "proposta_recusada": "proposta_recusada",
  "proposta recusada": "proposta_recusada",
  "contrato_assinado": "contrato_assinado",
  "contrato assinado": "contrato_assinado",
};

export function normalizeStatus(raw: string): string {
  const key = raw.toLowerCase().trim();
  return STATUS_MAP[key] ?? "leads_entrada";
}
