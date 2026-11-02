// Integração contra o projeto Supabase (SUP-S2-08): regras do envio que não
// dependem da Meta — autenticação, janela fechada no servidor e status que só
// avançam (aplicados pela função do banco que o webhook usa).
import { describe, it, expect, afterAll } from "vitest";
import {
  hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt, callFunction, type TempUser,
} from "./supabase-admin";

const admin = hasSupabaseCredentials ? adminClient() : null;
const leadIds: string[] = [];
const users: TempUser[] = [];
const rnd = () => Math.floor(Math.random() * 1e6).toString().padStart(6, "0");

async function newLead(): Promise<string> {
  const { data, error } = await admin!.from("leads").insert({ nome: "TESTE ENVIO (apagar)", whatsapp: `00904${rnd()}`, funil: "teste" }).select("id").single();
  if (error) throw error;
  leadIds.push(data.id);
  return data.id;
}

async function sentMessage(leadId: string, status = "enviado") {
  const { data: conv } = await admin!.from("whatsapp_conversations").upsert({ lead_id: leadId }, { onConflict: "lead_id" }).select("id").single();
  const wamid = `wamid.out.${rnd()}${rnd()}`;
  const { data, error } = await admin!.from("whatsapp_messages").insert({
    conversation_id: conv!.id, lead_id: leadId, direction: "enviada", type: "texto", content: "oi", status, wamid,
  }).select("id").single();
  if (error) throw error;
  return { id: data.id as string, wamid };
}

const statusOf = async (id: string) => (await admin!.from("whatsapp_messages").select("status, status_error").eq("id", id).single()).data!;
const apply = (wamid: string, status: string, err: string | null = null) => admin!.rpc("whatsapp_apply_status", { p_wamid: wamid, p_status: status, p_error: err });

describe.skipIf(!hasSupabaseCredentials)("envio de mensagens — servidor", () => {
  afterAll(async () => {
    for (const id of leadIds) await admin!.from("leads").delete().eq("id", id);
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
  }, 60_000);

  it("CA-S2-20: chamada de envio sem usuário autenticado é recusada (e sem papel também)", async () => {
    const leadId = await newLead();
    const res = await callFunction("whatsapp-send", null, { lead_id: leadId, kind: "text", text: "oi" });
    expect(res.status).toBe(401);
    const u = await createTempUser(admin!, "s2ca20"); users.push(u);
    await admin!.from("user_roles").delete().eq("user_id", u.id);
    expect((await callFunction("whatsapp-send", await signInJwt(u), { lead_id: leadId, kind: "text", text: "oi" })).status).toBe(403);
    const { count } = await admin!.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
    expect(count).toBe(0);
  }, 60_000);

  it("CA-S2-16: o servidor recusa texto livre para lead sem mensagem recebida nas últimas 24 horas", async () => {
    const leadId = await newLead();
    const u = await createTempUser(admin!, "s2ca16"); users.push(u);
    const res = await callFunction("whatsapp-send", await signInJwt(u), { lead_id: leadId, kind: "text", text: "oi" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, code: "janela_fechada", error: "Janela de 24 horas fechada. Envie um template." });
    const { count } = await admin!.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
    expect(count).toBe(0);
  }, 60_000);

  it("CA-S2-18: entregue e lido atualizam a mensagem nessa ordem e o status nunca regride", async () => {
    const leadId = await newLead();
    const m = await sentMessage(leadId);
    await apply(m.wamid, "entregue");
    expect((await statusOf(m.id)).status).toBe("entregue");
    await apply(m.wamid, "lido");
    expect((await statusOf(m.id)).status).toBe("lido");
    await apply(m.wamid, "entregue"); // chegou atrasado
    expect((await statusOf(m.id)).status).toBe("lido");
    await apply(m.wamid, "falhou", "x"); // falha não sobrescreve lido
    expect((await statusOf(m.id)).status).toBe("lido");
  }, 60_000);

  it("CA-S2-19: falha informada pela Meta por status vira 'falhou' com o motivo traduzido", async () => {
    const leadId = await newLead();
    const m = await sentMessage(leadId);
    const { data } = await apply(m.wamid, "falhou", "Janela de 24 horas fechada. Envie um template.");
    expect(data).toBe(true);
    expect(await statusOf(m.id)).toEqual({ status: "falhou", status_error: "Janela de 24 horas fechada. Envie um template." });
    await apply(m.wamid, "entregue");
    expect((await statusOf(m.id)).status).toBe("falhou");
  }, 60_000);
});
