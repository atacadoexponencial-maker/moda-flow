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
    const metaAppId = Deno.env.get("META_APP_ID");
    const metaAppSecret = Deno.env.get("META_APP_SECRET");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);
    }
    if (!metaAppId || !metaAppSecret) {
      console.error("Missing META_APP_ID / META_APP_SECRET");
      return jsonResponse({ error: "META_APP_ID/META_APP_SECRET não configurados" }, 500);
    }

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: userError } = await userClient.auth.getUser();
    if (userError) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Validate body
    const { code, waba_id, phone_number_id, state } = await req.json();
    if (!code || !waba_id || !phone_number_id) {
      return jsonResponse(
        { error: "Parâmetros obrigatórios ausentes: code, waba_id, phone_number_id" },
        400
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Validate CSRF state against whatsapp_config
    const { data: config } = await adminClient
      .from("whatsapp_config")
      .select("id, oauth_state")
      .limit(1)
      .maybeSingle();

    if (!config || !config.oauth_state || config.oauth_state !== state) {
      return jsonResponse({ error: "Estado inválido (CSRF)" }, 401);
    }

    // 1) Exchange code for permanent business integration system user token.
    //    Embedded Signup: NO redirect_uri. Token is permanent (no expiry).
    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
        `?client_id=${encodeURIComponent(metaAppId)}` +
        `&client_secret=${encodeURIComponent(metaAppSecret)}` +
        `&code=${encodeURIComponent(code)}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error("Token exchange error:", tokenData.error);
      return jsonResponse({ error: "Falha ao trocar código por token" }, 502);
    }

    const accessToken: string = tokenData.access_token;

    // 2) Subscribe the app to the WABA's webhooks
    const subRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(waba_id)}/subscribed_apps`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const subData = await subRes.json();

    if (subData.error || subData.success === false) {
      console.error("subscribed_apps error:", subData.error);
      return jsonResponse({ error: "Falha ao inscrever o app no WABA" }, 502);
    }

    // 3) Discover phone number details
    const phoneRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phone_number_id)}` +
        `?fields=display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const phoneData = await phoneRes.json();

    if (phoneData.error) {
      console.error("phone number fetch error:", phoneData.error);
      return jsonResponse({ error: "Falha ao obter dados do número" }, 502);
    }

    const displayPhoneNumber = phoneData.display_phone_number ?? null;
    const verifiedName = phoneData.verified_name ?? null;

    // 4) Store token in Vault (upsert by name)
    const { data: vaultSecretId, error: vaultErr } = await adminClient.rpc("vault_upsert_secret", {
      p_secret: accessToken,
      p_name: "whatsapp_access_token",
    });

    if (vaultErr || !vaultSecretId) {
      console.error("vault_upsert_secret error:", vaultErr);
      return jsonResponse({ error: "Falha ao salvar token no Vault" }, 500);
    }

    // 5) Persist config — mark ativo=true only at the very end
    const { error: updateErr } = await adminClient
      .from("whatsapp_config")
      .update({
        vault_secret_id: vaultSecretId,
        waba_id,
        phone_number_id,
        display_phone_number: displayPhoneNumber,
        verified_name: verifiedName,
        ativo: true,
        oauth_state: null,
      })
      .eq("id", config.id);

    if (updateErr) {
      console.error("whatsapp_config update error:", updateErr);
      return jsonResponse({ error: "Falha ao salvar configuração" }, 500);
    }

    // Never return the token
    return jsonResponse({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
