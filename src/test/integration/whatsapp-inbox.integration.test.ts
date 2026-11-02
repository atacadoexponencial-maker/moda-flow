// @vitest-environment node
// Integração contra o projeto Supabase (SUP-S2-08): a caixa de entrada recebe
// em tempo real a atualização da conversa quando chega mensagem.
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt, SUPABASE_URL, ANON_KEY, type TempUser } from "./supabase-admin";

const admin = hasSupabaseCredentials ? adminClient() : null;
const leadIds = new Set<string>();
const users: TempUser[] = [];
const rnd = () => Math.floor(Math.random() * 1e6).toString().padStart(6, "0");

async function inbound(from: string, content: string) {
  const { data, error } = await admin!.rpc("whatsapp_ingest_message", {
    p_phone_number_id: "test-phone-id", p_from: from, p_profile_name: "TESTE INBOX (apagar)",
    p_wamid: `wamid.inbox.${rnd()}${rnd()}`, p_type: "texto", p_content: content, p_media: null,
    p_reply_to_wamid: null, p_ts: new Date().toISOString(), p_preview: content,
  });
  if (error) throw error;
  const r = data as { lead_id: string; conversation_id: string };
  leadIds.add(r.lead_id);
  return r;
}

describe.skipIf(!hasSupabaseCredentials)("caixa de entrada — tempo real", () => {
  afterAll(async () => {
    for (const id of leadIds) await admin!.from("leads").delete().eq("id", id);
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
  }, 60_000);

  it("CA-S2-28: mensagem de um lead atualiza a conversa na caixa de entrada aberta em menos de 3 segundos", async () => {
    const from = `5500907${rnd()}`;
    const first = await inbound(from, "primeira");
    const u = await createTempUser(admin!, "s2ca28"); users.push(u);
    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    client.realtime.setAuth(await signInJwt(u));

    let sentAt = 0;
    const ev = await new Promise<{ unread: number; text: string; at: number }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("nenhum evento em 10s")), 10_000);
      client
        .channel(`test-inbox-${first.conversation_id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "whatsapp_conversations", filter: `id=eq.${first.conversation_id}` }, (p) => {
          const n = p.new as { unread_count: number; last_message_text: string };
          if (n.last_message_text !== "segunda") return;
          clearTimeout(timer);
          resolve({ unread: n.unread_count, text: n.last_message_text, at: Date.now() });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await new Promise((r) => setTimeout(r, 500));
            sentAt = Date.now();
            await inbound(from, "segunda");
          }
        });
    });
    await client.removeAllChannels();
    expect(ev).toMatchObject({ unread: 2, text: "segunda" });
    expect(ev.at - sentAt).toBeLessThan(3000);
  }, 30_000);
});
