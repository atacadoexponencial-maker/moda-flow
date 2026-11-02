// Edge Function: whatsapp-send (S2-04)
// Envia texto, imagem/PDF ou template ao lead pelo número conectado. Exige
// usuário logado com papel no CRM. Regras em _shared/whatsapp-send.ts.
import { sendMessage, type SendRepo } from "../_shared/whatsapp-send.ts";
import { MEDIA_BUCKET } from "../_shared/whatsapp-media.ts";
import { corsHeaders, json, readWhatsAppToken, requireCrmRole } from "../_shared/edge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const caller = await requireCrmRole(req);
    if (caller instanceof Response) return caller;
    const { admin: db, userId, email } = caller;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, code: "dados", error: "Corpo inválido" }, 400);
    }

    const repo: SendRepo = {
      async getLead(id) {
        const { data } = await db.from("leads").select("id, whatsapp").eq("id", id).maybeSingle();
        return data ?? null;
      },
      async getConversation(leadId) {
        const { data } = await db.from("whatsapp_conversations").select("id, last_inbound_at").eq("lead_id", leadId).maybeSingle();
        return data ?? null;
      },
      async ensureConversation(leadId) {
        await db.from("whatsapp_conversations").upsert({ lead_id: leadId }, { onConflict: "lead_id", ignoreDuplicates: true });
        const { data, error } = await db.from("whatsapp_conversations").select("id, last_inbound_at").eq("lead_id", leadId).single();
        if (error) throw error;
        return data;
      },
      async getConfig() {
        const { data } = await db.from("whatsapp_config").select("phone_number_id, vault_secret_id, ativo").limit(1).maybeSingle();
        if (!data?.ativo || !data.phone_number_id) return null;
        const token = await readWhatsAppToken(db, data.vault_secret_id);
        return token ? { phone_number_id: data.phone_number_id, token } : null;
      },
      async getTemplate(name, language) {
        const { data } = await db.from("whatsapp_templates").select("name, language, status, category, components").eq("name", name).eq("language", language).maybeSingle();
        return (data as never) ?? null;
      },
      async signedUrl(path) {
        const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
        return data?.signedUrl ?? null;
      },
      async insertMessage(row) {
        const { data, error } = await db.from("whatsapp_messages").insert(row).select("id").single();
        if (error) throw error;
        return data.id as string;
      },
      async markSent(id, wamid) {
        await db.from("whatsapp_messages").update({ status: "enviado", wamid }).eq("id", id).eq("status", "enviando");
      },
      async markFailed(id, error) {
        await db.from("whatsapp_messages").update({ status: "falhou", status_error: error }).eq("id", id);
      },
      async touchConversation(conversationId, preview, at) {
        await db
          .from("whatsapp_conversations")
          .update({ last_message_at: at, last_message_text: preview, last_message_direction: "enviada" })
          .eq("id", conversationId);
      },
      async touchLead(leadId, day) {
        await db.from("leads").update({ data_ultimo_contato: day }).eq("id", leadId);
      },
    };

    const r = await sendMessage(body as never, { userId, email }, { fetch, repo });
    if ("error" in r) return json({ success: false, code: r.code, error: r.error, message_id: r.message_id ?? null });
    return json({ success: true, message_id: r.message_id, wamid: r.wamid });
  } catch (err) {
    console.error("whatsapp-send:", err);
    return json({ success: false, code: "erro", error: "Erro interno" }, 500);
  }
});
