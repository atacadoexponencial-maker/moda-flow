import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    const frontendBase = Deno.env.get("FRONTEND_URL") || url.origin.replace("/functions/v1/meta-oauth-callback", "");

    if (errorParam) {
      return Response.redirect(
        `${frontendBase}/configuracoes/meta-ads?meta=erro&msg=${encodeURIComponent(errorParam)}`,
        302
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${frontendBase}/configuracoes/meta-ads?meta=erro&msg=missing_params`,
        302
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAppId = Deno.env.get("META_APP_ID")!;
    const metaAppSecret = Deno.env.get("META_APP_SECRET")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Validate CSRF state
    const { data: config } = await adminClient
      .from("meta_config")
      .select("id, oauth_state")
      .limit(1)
      .single();

    if (!config || config.oauth_state !== state) {
      return Response.redirect(
        `${frontendBase}/configuracoes/meta-ads?meta=erro&msg=invalid_state`,
        302
      );
    }

    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

    // Exchange code for short-lived token
    const tokenRes = await fetch("https://graph.facebook.com/v19.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: metaAppId,
        client_secret: metaAppSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return Response.redirect(
        `${frontendBase}/configuracoes/meta-ads?meta=erro&msg=${encodeURIComponent(tokenData.error.message || "token_exchange_failed")}`,
        302
      );
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${metaAppId}` +
        `&client_secret=${metaAppSecret}` +
        `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`
    );
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      console.error("Long-lived token error:", longLivedData.error);
      return Response.redirect(
        `${frontendBase}/configuracoes/meta-ads?meta=erro&msg=${encodeURIComponent(longLivedData.error.message || "long_lived_failed")}`,
        302
      );
    }

    const longLivedToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000;

    // Fetch Meta user name
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=name&access_token=${encodeURIComponent(longLivedToken)}`
    );
    const meData = await meRes.json();
    const metaUserName = meData.name || "Conta Meta";

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Store token directly in meta_config (protected by RLS + service role only)
    await adminClient
      .from("meta_config")
      .update({
        access_token: longLivedToken,
        token_expires_at: tokenExpiresAt,
        meta_user_name: metaUserName,
        oauth_state: null,
      })
      .eq("id", config.id);

    return Response.redirect(
      `${frontendBase}/configuracoes/meta-ads?meta=conectado`,
      302
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response("Erro interno", { status: 500 });
  }
});
