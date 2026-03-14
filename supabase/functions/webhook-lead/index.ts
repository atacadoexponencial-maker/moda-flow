import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

function mapPayloadToLead(body: Record<string, unknown>): Record<string, unknown> {
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (body[k] !== undefined && body[k] !== null && body[k] !== "") return body[k];
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

const STATUS_MAP: Record<string, string> = {
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

function normalizeStatus(raw: string): string {
  const key = raw.toLowerCase().trim();
  return STATUS_MAP[key] ?? "leads_entrada";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = req.headers.get("x-webhook-token");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing x-webhook-token header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validate token
  const { data: webhookConfig, error: configError } = await supabase
    .from("webhook_configs")
    .select("id, enabled")
    .eq("token", token)
    .single();

  if (configError || !webhookConfig) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!webhookConfig.enabled) {
    return new Response(JSON.stringify({ error: "Webhook is disabled" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const leadRecord = mapPayloadToLead(body);

  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert(leadRecord)
    .select("id")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return new Response(JSON.stringify({ error: "Failed to create lead", details: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update webhook stats
  await supabase.rpc("increment_webhook_leads", { config_id: webhookConfig.id });

  return new Response(JSON.stringify({ success: true, lead_id: lead.id }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
