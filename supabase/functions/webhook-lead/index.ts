import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";
import { mapPayloadToLead } from "./map-payload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

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
