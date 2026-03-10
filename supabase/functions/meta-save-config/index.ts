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

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token, ad_account_id, ativo } = await req.json();

    // Use service role for vault + meta_config operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if config row exists
    const { data: existing } = await adminClient
      .from("meta_config")
      .select("id, vault_secret_id")
      .limit(1)
      .single();

    let vaultSecretId = existing?.vault_secret_id ?? null;

    // If access_token provided, store/update in vault
    if (access_token && access_token.trim() !== "") {
      if (vaultSecretId) {
        // Update existing vault secret
        await adminClient.rpc("vault_update_secret", {
          secret_id: vaultSecretId,
          new_secret: access_token,
          new_name: "meta_access_token",
        });
      } else {
        // Create new vault secret
        const { data: vaultData, error: vaultError } = await adminClient.rpc(
          "vault_create_secret",
          {
            new_secret: access_token,
            new_name: "meta_access_token",
          }
        );
        if (vaultError) {
          console.error("Vault error:", vaultError);
          return new Response(
            JSON.stringify({ error: "Falha ao salvar token no Vault" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        vaultSecretId = vaultData;
      }
    }

    const configPayload: Record<string, unknown> = {
      ad_account_id: ad_account_id ?? null,
      ativo: ativo ?? false,
    };
    if (vaultSecretId) {
      configPayload.vault_secret_id = vaultSecretId;
    }

    let result;
    if (existing) {
      result = await adminClient
        .from("meta_config")
        .update(configPayload)
        .eq("id", existing.id);
    } else {
      result = await adminClient.from("meta_config").insert(configPayload);
    }

    if (result.error) {
      console.error("Config save error:", result.error);
      return new Response(
        JSON.stringify({ error: "Falha ao salvar configuração" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
