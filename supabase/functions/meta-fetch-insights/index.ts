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

    // Validate user
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

    // 1. Get config
    const { data: config } = await adminClient
      .from("meta_config")
      .select("id, ad_account_id, ativo, token_expires_at, vault_secret_id")
      .limit(1)
      .single();

    if (!config?.ad_account_id) {
      return new Response(
        JSON.stringify({ error: "Configuração incompleta. Configure o Ad Account ID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.ativo) {
      return new Response(
        JSON.stringify({ error: "Integração desativada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Read access token exclusively from Vault
    const { data: vaultToken, error: vaultError } = await adminClient.rpc("vault_read_secret_by_name", {
      secret_name: "meta_access_token",
    });

    if (vaultError || !vaultToken) {
      return new Response(
        JSON.stringify({ error: "Integração Meta não configurada. Reconecte em Configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken: string = vaultToken;

    // 3. Check token expiration — renew if within 10 days
    if (config.token_expires_at) {
      const expiresAt = new Date(config.token_expires_at).getTime();
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;

      if (expiresAt - Date.now() <= tenDaysMs) {
        console.log("Token expiring soon, attempting renewal...");

        const metaAppId = Deno.env.get("META_APP_ID");
        const metaAppSecret = Deno.env.get("META_APP_SECRET");

        if (metaAppId && metaAppSecret) {
          const renewRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token` +
              `?grant_type=fb_exchange_token` +
              `&client_id=${metaAppId}` +
              `&client_secret=${metaAppSecret}` +
              `&fb_exchange_token=${encodeURIComponent(accessToken)}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          const renewData = await renewRes.json();

          if (!renewData.error && renewData.access_token) {
            accessToken = renewData.access_token;
            const expiresIn = renewData.expires_in || 5184000;
            const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

            // Update token in Vault
            if (config.vault_secret_id) {
              await adminClient.rpc("vault_update_secret", {
                secret_id: config.vault_secret_id,
                new_secret: accessToken,
                new_name: "meta_access_token",
              });
            }

            // Update expiration in meta_config
            await adminClient
              .from("meta_config")
              .update({ token_expires_at: newExpiresAt })
              .eq("id", config.id);

            console.log("Token renewed successfully, new expiry:", newExpiresAt);
          } else {
            console.error("Token renewal failed:", renewData.error);
          }
        } else {
          console.warn("Cannot renew: META_APP_ID or META_APP_SECRET not set");
        }
      }
    }

    // 4. Fetch insights from Meta Marketing API — last 30 days
    const fields = "campaign_id,campaign_name,spend,impressions,clicks";
    const insightsUrl =
      `https://graph.facebook.com/v19.0/${config.ad_account_id}/insights` +
      `?fields=${fields}` +
      `&date_preset=last_30d` +
      `&level=campaign` +
      `&limit=500`;

    let allRows: any[] = [];
    let nextUrl: string | null = insightsUrl;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await response.json();

      if (json.error) {
        console.error("Meta API error:", json.error);
        return new Response(
          JSON.stringify({ error: json.error.message || "Erro na API do Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (json.data) {
        for (const row of json.data) {
          allRows.push({
            date_start: row.date_start,
            date_stop: row.date_stop,
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            spend: parseFloat(row.spend || "0"),
            impressions: parseInt(row.impressions || "0", 10),
            clicks: parseInt(row.clicks || "0", 10),
          });
        }
      }

      nextUrl = json.paging?.next ?? null;
    }

    // 5. Clear old cache and insert new data
    await adminClient
      .from("meta_ads_cache")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (allRows.length > 0) {
      for (let i = 0; i < allRows.length; i += 500) {
        const batch = allRows.slice(i, i + 500);
        const { error: insertError } = await adminClient
          .from("meta_ads_cache")
          .insert(batch);
        if (insertError) {
          console.error("Insert error:", insertError);
        }
      }
    }

    // 6. Return count
    return new Response(
      JSON.stringify({ success: true, campaigns_synced: allRows.length }),
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
