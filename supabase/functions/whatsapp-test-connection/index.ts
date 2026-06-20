import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const GRAPH_VERSION = "v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require Bearer auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Read env (fail clearly if missing)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);
    }

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !authUser) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get connection details from whatsapp_config
    const { data: config } = await adminClient
      .from("whatsapp_config")
      .select("vault_secret_id, phone_number_id")
      .limit(1)
      .maybeSingle();

    if (!config?.vault_secret_id || !config?.phone_number_id) {
      return jsonResponse({ error: "Nenhum número conectado" }, 400);
    }

    // Read token from vault
    const { data: secretData, error: secretError } = await adminClient.rpc(
      "vault_read_secret",
      { secret_id: config.vault_secret_id }
    );
    if (secretError || !secretData) {
      console.error("Vault read error:", secretError);
      return jsonResponse({ error: "Falha ao ler token do Vault" }, 500);
    }

    const accessToken = secretData;

    // Confirm the phone number with Meta (Graph API)
    const phoneRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(config.phone_number_id)}` +
        `?fields=display_phone_number,verified_name,quality_rating` +
        `&access_token=${encodeURIComponent(accessToken)}`
    );
    const phoneData = await phoneRes.json();

    if (phoneData.error) {
      return jsonResponse({
        success: false,
        error: phoneData.error.message || "Número inativo ou token inválido",
      });
    }

    // Never return the token
    return jsonResponse({
      success: true,
      display_phone_number: phoneData.display_phone_number ?? null,
      verified_name: phoneData.verified_name ?? null,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
