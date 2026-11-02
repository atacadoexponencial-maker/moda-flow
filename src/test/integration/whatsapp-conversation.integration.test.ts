// @vitest-environment node
// Integração contra o projeto Supabase (SUP-S2-08): abrir a conversa zera as
// não lidas (função publicada) e mensagens novas chegam em tempo real.
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt, callFunction,
  SUPABASE_URL, ANON_KEY, type TempUser,
} from "./supabase-admin";

const admin = hasSupabaseCredentials ? adminClient() : null;
const leadIds = new Set<string>();
const users: TempUser[] = [];
const rnd = () => Math.floor(Math.random() * 1e6).toString().padStart(6, "0");

async function inbound(from: string, content: string) {
  const { data, error } = await admin!.rpc("whatsapp_ingest_message", {
    p_phone_number_id: "test-phone-id", p_from: from, p_profile_name: "TESTE CONVERSA (apagar)",
    p_wamid: `wamid.conv.${rnd()}${rnd()}`, p_type: "texto", p_content: content, p_media: null,
    p_reply_to_wamid: null, p_ts: new Date().toISOString(), p_preview: content,
  });
  if (error) throw error;
  const r = data as { lead_id: string; conversation_id: string; message_id: string };
  leadIds.add(r.lead_id);
  return r;
}

describe.skipIf(!hasSupabaseCredentials)("conversa no painel do lead — servidor e tempo real", () => {
  afterAll(async () => {
    for (const id of leadIds) await admin!.from("leads").delete().eq("id", id);
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
  }, 60_000);

  it("CA-S2-21: abrir a conversa zera as não lidas e marca as recebidas como lidas", async () => {
    const from = `5500905${rnd()}`;
    const r = await inbound(from, "um");
    await inbound(from, "dois");
    await inbound(from, "três");
    const { data: before } = await admin!.from("whatsapp_conversations").select("unread_count").eq("id", r.conversation_id).single();
    expect(before?.unread_count).toBe(3);

    const u = await createTempUser(admin!, "s2ca21"); users.push(u);
    const res = await callFunction("whatsapp-mark-read", await signInJwt(u), { lead_id: r.lead_id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, unread_count: 0 });

    const { data: after } = await admin!.from("whatsapp_conversations").select("unread_count").eq("id", r.conversation_id).single();
    expect(after?.unread_count).toBe(0);
    const { data: msgs } = await admin!.from("whatsapp_messages").select("read_at").eq("conversation_id", r.conversation_id);
    expect(msgs?.every((m) => m.read_at !== null)).toBe(true);
  }, 60_000);

  it("CA-S2-22: mensagem nova gravada para o lead chega à tela aberta em menos de 3 segundos", async () => {
    const from = `5500905${rnd()}`;
    const first = await inbound(from, "abrindo a conversa");
    const u = await createTempUser(admin!, "s2ca22"); users.push(u);
    const jwt = await signInJwt(u);
    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    client.realtime.setAuth(jwt);

    const received = new Promise<{ content: string; at: number }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("nenhum evento em 10s")), 10_000);
      client
        .channel(`test-wa-${first.lead_id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `lead_id=eq.${first.lead_id}` }, (p) => {
          clearTimeout(timer);
          resolve({ content: (p.new as { content: string }).content, at: Date.now() });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await new Promise((r) => setTimeout(r, 500));
            sentAt = Date.now();
            await inbound(from, "chegou em tempo real");
          }
        });
    });
    let sentAt = 0;
    const ev = await received;
    await client.removeAllChannels();
    expect(ev.content).toBe("chegou em tempo real");
    expect(ev.at - sentAt).toBeLessThan(3000);
  }, 30_000);
});
