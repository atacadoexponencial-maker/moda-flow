// Edge Function: whatsapp-connect (S2-01)
// Conecta ou troca o número por configuração manual: WABA, identificador do
// número e token de usuário de sistema. Valida tudo na Meta antes de gravar;
// o token vai para o Vault e nunca volta na resposta.
import { connectNumber, type ConnectionStore } from "../_shared/whatsapp-connection.ts";
import { corsHeaders, json, requireCrmRole } from "../_shared/edge.ts";

const VAULT_SECRET_NAME = "whatsapp_access_token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const caller = await requireCrmRole(req);
    if (caller instanceof Response) return caller;
    const { admin } = caller;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "Corpo inválido" }, 400);
    }

    const store: ConnectionStore = {
      async saveToken(token) {
        const { data, error } = await admin.rpc("vault_upsert_secret", { p_secret: token, p_name: VAULT_SECRET_NAME });
        if (error || !data) throw new Error(error?.message ?? "Vault sem retorno");
        return String(data);
      },
      async saveConfig(cfg) {
        const { data: existing } = await admin.from("whatsapp_config").select("id").limit(1).maybeSingle();
        const row = { ...cfg, oauth_state: null };
        const res = existing?.id
          ? await admin.from("whatsapp_config").update(row).eq("id", existing.id)
          : await admin.from("whatsapp_config").insert(row);
        if (res.error) throw new Error(res.error.message);
      },
    };

    const result = await connectNumber(
      {
        waba_id: String(body.waba_id ?? ""),
        phone_number_id: String(body.phone_number_id ?? ""),
        access_token: String(body.access_token ?? ""),
      },
      { fetch, store },
    );

    if ("error" in result) return json({ success: false, step: result.step, error: result.error });
    return json({ success: true, connection: result.connection });
  } catch (err) {
    console.error("whatsapp-connect:", err);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
