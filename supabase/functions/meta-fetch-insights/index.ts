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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get config
    const { data: config } = await adminClient
      .from("meta_config")
      .select("vault_secret_id, ad_account_id, ativo")
      .limit(1)
      .single();

    if (!config?.vault_secret_id || !config?.ad_account_id) {
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

    // Read token from vault
    const { data: accessToken, error: secretError } = await adminClient.rpc(
      "vault_read_secret",
      { secret_id: config.vault_secret_id }
    );
    if (secretError || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Falha ao ler token do Vault" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch insights from Meta — last 90 days, daily breakdown by campaign
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
      // Insert in batches of 500
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
