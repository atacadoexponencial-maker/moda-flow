// Edge Function: whatsapp-disconnect (S2-01)
// Apaga o token do Vault, marca a conexão como inativa e remove (melhor
// esforço) a assinatura do app na WABA. Conversas e mensagens são mantidas.
import { unsubscribeAppFromWaba } from "../_shared/whatsapp-graph.ts";
import { corsHeaders, json, readWhatsAppToken, requireCrmRole } from "../_shared/edge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const caller = await requireCrmRole(req);
    if (caller instanceof Response) return caller;
    const { admin } = caller;

    const { data: config } = await admin
      .from("whatsapp_config")
      .select("id, vault_secret_id, waba_id")
      .limit(1)
      .maybeSingle();
    if (!config) return json({ success: true });

    const token = await readWhatsAppToken(admin, config.vault_secret_id);
    if (token && config.waba_id) {
      const r = await unsubscribeAppFromWaba(fetch, token, config.waba_id);
      if ("error" in r) console.warn("whatsapp-disconnect: unsubscribe falhou:", r.error.message);
    }

    if (config.vault_secret_id) {
      await admin.rpc("vault_delete_secret", { secret_id: config.vault_secret_id });
    }

    const { error } = await admin
      .from("whatsapp_config")
      .update({ vault_secret_id: null, ativo: false, webhook_subscribed_at: null, oauth_state: null })
      .eq("id", config.id);
    if (error) throw error;

    return json({ success: true });
  } catch (err) {
    console.error("whatsapp-disconnect:", err);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
