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

  // A deduplicação acontece no banco (trigger BEFORE INSERT em leads):
  // - contato novo  -> a linha é criada e retornada aqui;
  // - contato existente -> o trigger registra um touch de retorno e descarta
  //   o insert, então nenhuma linha é retornada (não é erro).
  const { data: inserted, error: insertError } = await supabase
    .from("leads")
    .insert(leadRecord)
    .select("id");

  if (insertError) {
    console.error("Insert error:", insertError);
    return new Response(JSON.stringify({ error: "Failed to create lead", details: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let leadId: string | null = inserted?.[0]?.id ?? null;
  const isNew = leadId !== null;

  // Retorno (deduplicado): localiza o contato existente para responder o id.
  if (!leadId) {
    leadId = await findContactId(supabase, leadRecord.whatsapp, leadRecord.email);
  }

  // Update webhook stats
  await supabase.rpc("increment_webhook_leads", { config_id: webhookConfig.id });

  return new Response(JSON.stringify({ success: true, lead_id: leadId, is_new: isNew }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Localiza o contato existente pela mesma regra de identidade do banco,
// usada quando a submissão foi tratada como retorno (sem criar contato novo).
async function findContactId(
  supabase: ReturnType<typeof createClient>,
  whatsapp: unknown,
  email: unknown
): Promise<string | null> {
  const { data: waNorm } = await supabase.rpc("normalize_whatsapp", {
    raw: whatsapp == null ? "" : String(whatsapp),
  });
  if (waNorm) {
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("whatsapp_norm", waNorm)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data: emailNorm } = await supabase.rpc("normalize_email", {
    raw: email == null ? "" : String(email),
  });
  if (emailNorm) {
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("email_norm", emailNorm)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}
