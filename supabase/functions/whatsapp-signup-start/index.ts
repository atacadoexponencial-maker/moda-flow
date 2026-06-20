import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAppId = Deno.env.get("META_APP_ID");
    const whatsappConfigId = Deno.env.get("WHATSAPP_CONFIG_ID");

    if (!metaAppId) {
      return new Response(
        JSON.stringify({ error: "META_APP_ID não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappConfigId) {
      return new Response(
        JSON.stringify({ error: "WHATSAPP_CONFIG_ID não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: userError } = await userClient.auth.getUser();
    if (userError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Generate CSRF state
    const state = crypto.randomUUID();

    // Upsert state into whatsapp_config
    const { data: existing } = await adminClient
      .from("whatsapp_config")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      await adminClient
        .from("whatsapp_config")
        .update({ oauth_state: state })
        .eq("id", existing.id);
    } else {
      await adminClient
        .from("whatsapp_config")
        .insert({ oauth_state: state });
    }

    // Public data only — never tokens or secrets
    return new Response(
      JSON.stringify({ state, app_id: metaAppId, config_id: whatsappConfigId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
