// Integração contra o projeto Supabase (SUP-S1-07): responsável pelo lead.
// Cria um usuário e um lead temporários, exercita atribuição, histórico e
// remoção em cascata, e apaga tudo ao final.
import { describe, it, expect, afterAll } from "vitest";
import { hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt, SUPABASE_URL, ANON_KEY, type TempUser } from "./supabase-admin";
import { createClient } from "@supabase/supabase-js";

const admin = hasSupabaseCredentials ? adminClient() : null;
const users: TempUser[] = [];
const leadIds: string[] = [];

async function newLead(nome: string): Promise<string> {
  const { data, error } = await admin!
    .from("leads")
    .insert({ nome, whatsapp: `00900${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`, funil: "teste" })
    .select("id")
    .single();
  if (error) throw error;
  leadIds.push(data.id);
  return data.id;
}

describe.skipIf(!hasSupabaseCredentials)("responsável pelo lead — banco", () => {
  afterAll(async () => {
    for (const id of leadIds) await admin!.from("leads").delete().eq("id", id);
    for (const u of users) {
      try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ }
    }
    const { data: left } = await admin!.from("leads").select("id").in("id", leadIds);
    expect(left ?? []).toHaveLength(0);
  }, 60_000);

  it("CA-S1-07: definir responsável grava no lead, registra na linha do tempo e o seletor lista o membro", async () => {
    const u = await createTempUser(admin!, "ca07"); users.push(u);
    const leadId = await newLead("TESTE RESPONSAVEL (apagar)");

    // como o usuário logado (JWT), igual ao painel
    const jwt = await signInJwt(u);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const members = await asUser.rpc("team_members");
    expect(members.error).toBeNull();
    expect((members.data as Array<{ user_id: string }>).some((m) => m.user_id === u.id)).toBe(true);

    const upd = await asUser.from("leads").update({ assigned_to: u.id }).eq("id", leadId).select("assigned_to").single();
    expect(upd.error).toBeNull();
    expect(upd.data?.assigned_to).toBe(u.id);

    const { data: acts } = await admin!.from("activities").select("type, content, created_by").eq("lead_id", leadId).eq("type", "assignment");
    expect(acts).toHaveLength(1);
    expect(acts![0].content).toContain("Responsável definido");
    expect(acts![0].content).toContain(u.email.split("@")[0]);
    expect(acts![0].created_by).toBe(u.email);
  }, 60_000);

  it("CA-S1-08: 'Assumir' grava o usuário logado como responsável", async () => {
    const u = await createTempUser(admin!, "ca08"); users.push(u);
    const leadId = await newLead("TESTE ASSUMIR (apagar)");
    const jwt = await signInJwt(u);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { assignPatch } = await import("../../lib/team");
    const upd = await asUser.from("leads").update(assignPatch(u.id)).eq("id", leadId).select("assigned_to").single();
    expect(upd.error).toBeNull();
    expect(upd.data?.assigned_to).toBe(u.id);
  }, 60_000);

  it("CA-S1-12: remover o usuário mantém o lead, zera o responsável e registra 'Responsável removido' por Sistema", async () => {
    const u = await createTempUser(admin!, "ca12");
    const leadId = await newLead("TESTE REMOCAO (apagar)");
    await admin!.from("leads").update({ assigned_to: u.id }).eq("id", leadId);

    await deleteTempUser(admin!, u.id);

    const { data: lead } = await admin!.from("leads").select("id, assigned_to").eq("id", leadId).single();
    expect(lead?.id).toBe(leadId);
    expect(lead?.assigned_to).toBeNull();

    const { data: acts } = await admin!.from("activities").select("content, created_by").eq("lead_id", leadId).eq("type", "assignment").order("created_at", { ascending: true });
    expect(acts?.at(-1)?.content).toContain("Responsável removido");
    expect(acts?.at(-1)?.created_by).toBe("Sistema");
  }, 60_000);
});
