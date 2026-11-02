// Edge Function: whatsapp-test-connection (S2-01)
// Confere na Meta o número configurado com o token guardado no Vault e devolve
// número exibido, nome verificado e qualidade. Nunca devolve o token.
import { testConnection } from "../_shared/whatsapp-connection.ts";
import { corsHeaders, json, readWhatsAppToken, requireCrmRole } from "../_shared/edge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const caller = await requireCrmRole(req);
    if (caller instanceof Response) return caller;
    const { admin } = caller;

    const { data: config } = await admin
      .from("whatsapp_config")
      .select("id, vault_secret_id, phone_number_id")
      .limit(1)
      .maybeSingle();
    if (!config?.vault_secret_id || !config?.phone_number_id) {
      return json({ success: false, error: "Nenhum número conectado" });
    }

    const token = await readWhatsAppToken(admin, config.vault_secret_id);
    if (!token) return json({ success: false, error: "Token não encontrado no servidor" });

    const result = await testConnection(fetch, token, config.phone_number_id);
    if ("error" in result) return json({ success: false, error: result.error });

    // Mantém o cartão de estado atualizado com o que a Meta informou agora.
    await admin.from("whatsapp_config").update(result.info).eq("id", config.id);

    return json({ success: true, ...result.info });
  } catch (err) {
    console.error("whatsapp-test-connection:", err);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
