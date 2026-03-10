import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function maybeRenewToken(
  adminClient: any,
  config: any,
  currentToken: string
): Promise<string> {
  if (!config.token_expires_at) return currentToken;

  const expiresAt = new Date(config.token_expires_at).getTime();
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000;

  if (expiresAt - Date.now() > tenDaysMs) return currentToken;

  console.log("Token expiring soon, attempting renewal...");

  const metaAppId = Deno.env.get("META_APP_ID");
  const metaAppSecret = Deno.env.get("META_APP_SECRET");

  if (!metaAppId || !metaAppSecret) {
    console.warn("Cannot renew: META_APP_ID or META_APP_SECRET not set");
    return currentToken;
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${metaAppId}` +
      `&client_secret=${metaAppSecret}` +
      `&fb_exchange_token=${encodeURIComponent(currentToken)}`
  );
  const data = await res.json();

  if (data.error || !data.access_token) {
    console.error("Token renewal failed:", data.error);
    return currentToken;
  }

  const newToken = data.access_token;
  const expiresIn = data.expires_in || 5184000;

  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await adminClient
    .from("meta_config")
    .update({ access_token: newToken, token_expires_at: newExpiresAt })
    .eq("id", config.id);

  console.log("Token renewed successfully, new expiry:", newExpiresAt);
  return newToken;
}

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

    // Get config
    const { data: config } = await adminClient
      .from("meta_config")
      .select("id, access_token, ad_account_id, ativo, token_expires_at")
      .limit(1)
      .single();

    if (!config?.access_token || !config?.ad_account_id) {
      return new Response(
        JSON.stringify({ error: "Configuração incompleta. Configure o token e o Ad Account ID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.ativo) {
      return new Response(
        JSON.stringify({ error: "Integração desativada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-renew if expiring soon
    const accessToken = await maybeRenewToken(adminClient, config, config.access_token);

    // Fetch insights from Meta — last 90 days
    const today = new Date();
    const since = new Date(today);
    since.setDate(since.getDate() - 90);

    const sinceStr = since.toISOString().slice(0, 10);
    const untilStr = today.toISOString().slice(0, 10);

    const fields = "campaign_id,campaign_name,spend,impressions,clicks,actions";
    const url = `https://graph.facebook.com/v21.0/${config.ad_account_id}/insights?fields=${fields}&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&level=campaign&limit=500&access_token=${encodeURIComponent(accessToken)}`;

    let allRows: any[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await fetch(nextUrl);
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
          const leadsAction = row.actions?.find((a: any) => a.action_type === "lead");
          allRows.push({
            date_start: row.date_start,
            date_stop: row.date_stop,
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            spend: parseFloat(row.spend || "0"),
            impressions: parseInt(row.impressions || "0", 10),
            clicks: parseInt(row.clicks || "0", 10),
            leads: leadsAction ? parseInt(leadsAction.value || "0", 10) : 0,
          });
        }
      }

      nextUrl = json.paging?.next ?? null;
    }

    // Clear old cache and insert new data
    await adminClient.from("meta_ads_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");

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
