// Edge Function: whatsapp-mark-read (S2-05)
// Ao abrir a conversa: zera as não lidas, marca as recebidas como lidas no CRM
// e envia o "visto" à Meta para a última recebida (SUP-S2-05, melhor esforço).
import { GRAPH } from "../_shared/whatsapp-graph.ts";
import { corsHeaders, json, readWhatsAppToken, requireCrmRole } from "../_shared/edge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const caller = await requireCrmRole(req);
    if (caller instanceof Response) return caller;
    const { admin: db } = caller;

    const { lead_id } = (await req.json().catch(() => ({}))) as { lead_id?: string };
    if (!lead_id) return json({ success: false, error: "lead_id obrigatório" }, 400);

    const { data: conv } = await db.from("whatsapp_conversations").select("id, unread_count").eq("lead_id", lead_id).maybeSingle();
    if (!conv) return json({ success: true, unread_count: 0 });

    const now = new Date().toISOString();
    await db.from("whatsapp_messages").update({ read_at: now }).eq("conversation_id", conv.id).eq("direction", "recebida").is("read_at", null);
    await db.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", conv.id);

    // "Visto" na Meta para a última mensagem recebida
    const { data: last } = await db
      .from("whatsapp_messages")
      .select("wamid")
      .eq("conversation_id", conv.id)
      .eq("direction", "recebida")
      .not("wamid", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: config } = await db.from("whatsapp_config").select("phone_number_id, vault_secret_id, ativo").limit(1).maybeSingle();
    if (last?.wamid && config?.ativo && config.phone_number_id) {
      const token = await readWhatsAppToken(db, config.vault_secret_id);
      if (token) {
        try {
          await fetch(`${GRAPH}/${encodeURIComponent(config.phone_number_id)}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: last.wamid }),
          });
        } catch (e) {
          console.warn("whatsapp-mark-read: visto falhou", e);
        }
      }
    }

    return json({ success: true, unread_count: 0 });
  } catch (err) {
    console.error("whatsapp-mark-read:", err);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
