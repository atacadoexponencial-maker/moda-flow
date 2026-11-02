// Edge Function: whatsapp-templates-sync (S2-03)
// Copia para o CRM os templates da conta (WABA), com paginação. A cópia local
// passa a ser exatamente a lista da Meta. Só proprietário/admin.
import { syncTemplates, type TemplateStore } from "../_shared/whatsapp-templates.ts";
import { corsHeaders, json, readWhatsAppToken, requireCrmRole } from "../_shared/edge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const caller = await requireCrmRole(req);
    if (caller instanceof Response) return caller;
    const { admin } = caller;

    const { data: config } = await admin
      .from("whatsapp_config")
      .select("waba_id, vault_secret_id, ativo")
      .limit(1)
      .maybeSingle();
    if (!config?.ativo || !config.waba_id) return json({ success: false, error: "Nenhum número conectado" });

    const token = await readWhatsAppToken(admin, config.vault_secret_id);
    if (!token) return json({ success: false, error: "Token não encontrado no servidor" });

    const store: TemplateStore = {
      async replaceAll(templates) {
        const now = new Date().toISOString();
        if (templates.length > 0) {
          const { error } = await admin.from("whatsapp_templates").upsert(
            templates.map((t) => ({
              meta_id: t.id,
              name: t.name,
              language: t.language,
              category: t.category,
              status: t.status,
              rejected_reason: t.rejected_reason,
              components: t.components,
              synced_at: now,
            })),
            { onConflict: "meta_id" },
          );
          if (error) throw new Error(error.message);
        }
        // Remove o que não existe mais na Meta
        const keep = templates.map((t) => t.id);
        const del = keep.length
          ? await admin.from("whatsapp_templates").delete().not("meta_id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`)
          : await admin.from("whatsapp_templates").delete().not("id", "is", null);
        if (del.error) throw new Error(del.error.message);
      },
    };

    const r = await syncTemplates({ fetch, token, wabaId: config.waba_id, store });
    if ("error" in r) return json({ success: false, error: r.error });
    return json({ success: true, count: r.count });
  } catch (err) {
    console.error("whatsapp-templates-sync:", err);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
