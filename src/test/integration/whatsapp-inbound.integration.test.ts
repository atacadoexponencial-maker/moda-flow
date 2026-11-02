// Integração contra o projeto Supabase (SUP-S2-08): gravação das mensagens
// recebidas pelas funções do banco que o webhook chama, privacidade da mídia e
// assinatura do webhook deployado. Tudo criado aqui é apagado no fim.
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt,
  SUPABASE_URL, ANON_KEY, type TempUser,
} from "./supabase-admin";
import { signBody } from "../../../supabase/functions/_shared/whatsapp-inbound";
import { windowState } from "../../../supabase/functions/_shared/whatsapp-window";
import { readFileSync, existsSync } from "node:fs";

const admin = hasSupabaseCredentials ? adminClient() : null;
const leadIds = new Set<string>();
const users: TempUser[] = [];
const objects: string[] = [];
const PHONE_ID = "test-phone-id";

const rnd = () => Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
const fromNew = () => `5500903${rnd()}`; // 13 dígitos → normalizado sem o 55

function appSecret(): string | null {
  if (!existsSync(".env")) return null;
  const line = readFileSync(".env", "utf-8").split(/\r?\n/).find((l) => l.startsWith("WHATSAPP_APP_SECRET="));
  return line ? line.split("=").slice(1).join("=").trim() : null;
}

async function ingest(args: Partial<{
  from: string; name: string | null; wamid: string; type: string; content: string | null;
  media: Record<string, unknown> | null; reply: string | null; ts: string; preview: string;
}>) {
  const { data, error } = await admin!.rpc("whatsapp_ingest_message", {
    p_phone_number_id: PHONE_ID,
    p_from: args.from!,
    p_profile_name: args.name ?? null,
    p_wamid: args.wamid ?? `wamid.test.${rnd()}${rnd()}`,
    p_type: args.type ?? "texto",
    p_content: args.content ?? "olá",
    p_media: args.media ?? null,
    p_reply_to_wamid: args.reply ?? null,
    p_ts: args.ts ?? new Date().toISOString(),
    p_preview: args.preview ?? args.content ?? "olá",
  });
  if (error) throw error;
  const r = data as { lead_id: string; conversation_id: string; message_id: string; created: boolean; lead_created: boolean };
  if (r.lead_id) leadIds.add(r.lead_id);
  return r;
}

async function newLead(whatsapp: string): Promise<string> {
  const { data, error } = await admin!.from("leads").insert({ nome: "TESTE WHATSAPP (apagar)", whatsapp, funil: "teste" }).select("id").single();
  if (error) throw error;
  leadIds.add(data.id);
  return data.id;
}

describe.skipIf(!hasSupabaseCredentials)("recebimento de mensagens — banco", () => {
  afterAll(async () => {
    if (objects.length) await admin!.storage.from("whatsapp-media").remove(objects);
    for (const id of leadIds) await admin!.from("leads").delete().eq("id", id);
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
    const { count } = await admin!.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("phone_number_id", PHONE_ID);
    expect(count).toBe(0);
  }, 90_000);

  it("CA-S2-07: mensagem de lead conhecido entra na conversa dele e soma não lida", async () => {
    const from = fromNew();
    const leadId = await newLead(`(${from.slice(2, 4)}) ${from.slice(4)}`); // formato livre: casa pela normalização
    const ts = "2026-11-01T15:00:00.000Z";
    const r = await ingest({ from, content: "Quero saber do workshop", ts });
    expect(r).toMatchObject({ lead_id: leadId, created: true, lead_created: false });

    const { data: msg } = await admin!.from("whatsapp_messages").select("direction, type, content, created_at, conversation_id").eq("id", r.message_id).single();
    expect(msg).toMatchObject({ direction: "recebida", type: "texto", content: "Quero saber do workshop" });
    expect(new Date(msg!.created_at).toISOString()).toBe(ts);
    const { data: conv } = await admin!.from("whatsapp_conversations").select("lead_id, unread_count, last_message_text, last_message_direction").eq("id", r.conversation_id).single();
    expect(conv).toMatchObject({ lead_id: leadId, unread_count: 1, last_message_text: "Quero saber do workshop", last_message_direction: "recebida" });

    await ingest({ from, content: "Estão aí?" });
    const { data: conv2 } = await admin!.from("whatsapp_conversations").select("unread_count").eq("id", r.conversation_id).single();
    expect(conv2?.unread_count).toBe(2);
  }, 60_000);

  it("CA-S2-08: telefone desconhecido vira lead novo em Leads de Entrada com funil whatsapp e a conversa", async () => {
    const from = fromNew();
    const r = await ingest({ from, name: "Bruna Lima", content: "Oi" });
    expect(r).toMatchObject({ created: true, lead_created: true });
    const { data: lead } = await admin!.from("leads").select("nome, funil, status, whatsapp").eq("id", r.lead_id).single();
    expect(lead).toEqual({ nome: "Bruna Lima", funil: "whatsapp", status: "leads_entrada", whatsapp: from });
    const { count } = await admin!.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("lead_id", r.lead_id);
    expect(count).toBe(1);

    const semNome = await ingest({ from: fromNew(), name: null, content: "Oi" });
    const { data: lead2 } = await admin!.from("leads").select("nome").eq("id", semNome.lead_id).single();
    expect(lead2?.nome).toMatch(/^5500903\d{6}$/);
  }, 60_000);

  it("CA-S2-09: mídia recebida fica marcada para download e o bucket é privado (só abre com login)", async () => {
    const from = fromNew();
    const r = await ingest({ from, type: "imagem", content: null, media: { id: "META-MEDIA-1", mime_type: "image/jpeg", filename: null }, preview: "📷 Imagem" });
    const { data: msg } = await admin!.from("whatsapp_messages").select("type, media_meta_id, media_mime, media_status").eq("id", r.message_id).single();
    expect(msg).toEqual({ type: "imagem", media_meta_id: "META-MEDIA-1", media_mime: "image/jpeg", media_status: "pendente" });

    const path = `${r.lead_id}/teste.jpg`;
    const up = await admin!.storage.from("whatsapp-media").upload(path, new Uint8Array([255, 216, 255]), { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    objects.push(path);
    await admin!.from("whatsapp_messages").update({ media_path: path, media_status: "ok" }).eq("id", r.message_id);

    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await anon.storage.from("whatsapp-media").download(path)).error).not.toBeNull();
    const pub = await fetch(`${SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${path}`);
    expect(pub.status).toBeGreaterThanOrEqual(400);

    const u = await createTempUser(admin!, "s2ca09"); users.push(u);
    const jwt = await signInJwt(u);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    expect((await asUser.storage.from("whatsapp-media").download(path)).error).toBeNull();
  }, 60_000);

  it("CA-S2-10: a mesma entrega repetida pela Meta é guardada uma vez só", async () => {
    const from = fromNew();
    const wamid = `wamid.dup.${rnd()}`;
    const a = await ingest({ from, wamid, content: "uma vez" });
    const b = await ingest({ from, wamid, content: "uma vez" });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.message_id).toBe(a.message_id);
    const { count } = await admin!.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("wamid", wamid);
    expect(count).toBe(1);
    const { data: conv } = await admin!.from("whatsapp_conversations").select("unread_count").eq("id", a.conversation_id).single();
    expect(conv?.unread_count).toBe(1);
  }, 60_000);

  it("CA-S2-12: o webhook publicado recusa assinatura inválida e não grava nada", async () => {
    const wamid = `wamid.badsig.${rnd()}`;
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_ID }, messages: [{ from: fromNew(), id: wamid, timestamp: "1730462400", type: "text", text: { body: "x" } }] } }] }] });
    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${await signBody("segredo-falso", body)}` },
      body,
    });
    expect(res.status).toBe(401);
    const sem = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    expect(sem.status).toBe(401);
    const { count } = await admin!.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("wamid", wamid);
    expect(count).toBe(0);
  }, 60_000);

  it("CA-S2-13: a janela de 24 horas acompanha a última mensagem recebida", async () => {
    const from = fromNew();
    const old = await ingest({ from, content: "antiga", ts: "2026-10-01T10:00:00.000Z" });
    const { data: c1 } = await admin!.from("whatsapp_conversations").select("last_inbound_at").eq("id", old.conversation_id).single();
    expect(windowState(c1!.last_inbound_at).open).toBe(false);

    const ts = new Date(Date.now() - 60_000).toISOString();
    await ingest({ from, content: "nova", ts });
    const { data: c2 } = await admin!.from("whatsapp_conversations").select("last_inbound_at").eq("id", old.conversation_id).single();
    const w = windowState(c2!.last_inbound_at);
    expect(w.open).toBe(true);
    expect(w.closesAt).toBe(new Date(new Date(ts).getTime() + 24 * 3600 * 1000).toISOString());
  }, 60_000);

  // Ponta a ponta pelo webhook publicado: só roda quando não há número real conectado
  // (configura temporariamente um número de teste e restaura no fim).
  it("webhook ponta a ponta: assinatura válida grava a mensagem; outro número é ignorado", async () => {
    const secret = appSecret();
    const { data: cfg } = await admin!.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (!secret || !cfg || cfg.ativo) return; // não mexe numa conexão real
    try {
      await admin!.from("whatsapp_config").update({ phone_number_id: PHONE_ID, ativo: true }).eq("id", cfg.id);
      const okWamid = `wamid.e2e.${rnd()}`;
      const otherWamid = `wamid.e2e.other.${rnd()}`;
      const from = fromNew();
      const mk = (phone: string, id: string) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phone }, contacts: [{ wa_id: from, profile: { name: "E2E" } }], messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "ponta a ponta" } }] } }] }] });
      for (const [phone, id] of [[PHONE_ID, okWamid], ["outro-numero", otherWamid]]) {
        const body = mk(phone, id);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${await signBody(secret, body)}` }, body });
        expect(res.status).toBe(200);
      }
      let found = 0;
      for (let i = 0; i < 15 && found === 0; i++) {
        const { data } = await admin!.from("whatsapp_messages").select("lead_id").eq("wamid", okWamid);
        found = data?.length ?? 0;
        data?.forEach((d) => leadIds.add(d.lead_id));
        if (!found) await new Promise((r) => setTimeout(r, 1000));
      }
      expect(found).toBe(1);
      const { count } = await admin!.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("wamid", otherWamid);
      expect(count).toBe(0);
    } finally {
      await admin!.from("whatsapp_config").update({ phone_number_id: cfg.phone_number_id, ativo: cfg.ativo }).eq("id", cfg.id);
    }
  }, 90_000);
});
