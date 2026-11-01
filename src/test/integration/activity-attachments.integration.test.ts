// Integração contra o projeto Supabase (SUP-S1-07): anexos de atividade.
// Cria lead, atividade, usuário temporário e objetos no bucket; apaga tudo ao final.
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt, SUPABASE_URL, ANON_KEY, type TempUser } from "./supabase-admin";
import { ATTACHMENTS_BUCKET, buildAttachmentPath } from "../../lib/attachments";

const admin = hasSupabaseCredentials ? adminClient() : null;
const users: TempUser[] = [];
const leadIds: string[] = [];

// PNG 1x1 válido
const PNG_BYTES = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
), (c) => c.charCodeAt(0));

async function newLead(nome: string): Promise<string> {
  const { data, error } = await admin!
    .from("leads")
    .insert({ nome, whatsapp: `00901${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`, funil: "teste" })
    .select("id").single();
  if (error) throw error;
  leadIds.push(data.id);
  return data.id;
}

async function newActivity(leadId: string, content: string | null): Promise<string> {
  const { data, error } = await admin!.from("activities").insert({ lead_id: leadId, type: "note", content }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function uploadPng(leadId: string, activityId: string, name: string): Promise<{ path: string }> {
  const path = buildAttachmentPath(leadId, activityId, name, Math.random().toString(36).slice(2, 8));
  const up = await admin!.storage.from(ATTACHMENTS_BUCKET).upload(path, PNG_BYTES, { contentType: "image/png" });
  if (up.error) throw up.error;
  const row = await admin!.from("activity_attachments").insert({ activity_id: activityId, lead_id: leadId, path, name, mime: "image/png", size: PNG_BYTES.length });
  if (row.error) throw row.error;
  return { path };
}


/** A remoção do objeto é assíncrona (trigger → API do Storage via pg_net): espera até sumir. */
async function waitUntilGone(prefix: string, timeoutMs = 15_000): Promise<number> {
  const start = Date.now();
  let remaining = -1;
  while (Date.now() - start < timeoutMs) {
    const { data } = await admin!.storage.from(ATTACHMENTS_BUCKET).list(prefix, { limit: 100 });
    remaining = (data ?? []).filter((o) => o.id).length;
    if (remaining === 0) return 0;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return remaining;
}

describe.skipIf(!hasSupabaseCredentials)("anexos de atividade — banco e storage", () => {
  afterAll(async () => {
    for (const id of leadIds) await admin!.from("leads").delete().eq("id", id);
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
    // nenhum objeto de teste pode sobrar no bucket
    for (const id of leadIds) {
      const { data: acts } = await admin!.from("activities").select("id").eq("lead_id", id);
      for (const a of acts ?? []) expect(await waitUntilGone(`${id}/${a.id}`)).toBe(0);
    }
  }, 90_000);

  it("CA-S1-17: atividade com texto e duas imagens fica com os dois anexos, baixáveis por usuário logado", async () => {
    const leadId = await newLead("TESTE ANEXOS (apagar)");
    const actId = await newActivity(leadId, "Print da conversa");
    const a = await uploadPng(leadId, actId, "print1.png");
    const b = await uploadPng(leadId, actId, "print2.png");

    const { data: rows } = await admin!.from("activity_attachments").select("path, mime").eq("activity_id", actId);
    expect(rows?.map((r) => r.path).sort()).toEqual([a.path, b.path].sort());
    expect(rows?.every((r) => r.mime === "image/png")).toBe(true);

    const u = await createTempUser(admin!, "ca17"); users.push(u);
    const jwt = await signInJwt(u);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const dl = await asUser.storage.from(ATTACHMENTS_BUCKET).download(a.path);
    expect(dl.error).toBeNull();
    expect(dl.data!.size).toBe(PNG_BYTES.length);
    const signed = await asUser.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(b.path, 60);
    expect(signed.error).toBeNull();
    expect(signed.data?.signedUrl).toContain(ATTACHMENTS_BUCKET);
  }, 60_000);

  it("CA-S1-18: atividade sem texto e com um arquivo é aceita", async () => {
    const leadId = await newLead("TESTE SO ANEXO (apagar)");
    const actId = await newActivity(leadId, null);
    await uploadPng(leadId, actId, "sem-texto.png");
    const { data: act } = await admin!.from("activities").select("content").eq("id", actId).single();
    expect(act?.content).toBeNull();
    const { count } = await admin!.from("activity_attachments").select("id", { count: "exact", head: true }).eq("activity_id", actId);
    expect(count).toBe(1);
  }, 60_000);

  it("CA-S1-19: o banco recusa o 6º anexo e tipo/tamanho fora do limite", async () => {
    const leadId = await newLead("TESTE LIMITE (apagar)");
    const actId = await newActivity(leadId, "limite");
    for (let i = 0; i < 5; i++) await uploadPng(leadId, actId, `l${i}.png`);
    const sixth = await admin!.from("activity_attachments").insert({ activity_id: actId, lead_id: leadId, path: `${leadId}/${actId}/x6.png`, name: "x6.png", mime: "image/png", size: 10 });
    expect(sixth.error?.message).toContain("no máximo 5 anexos");

    const act2 = await newActivity(leadId, "tipo");
    const badMime = await admin!.from("activity_attachments").insert({ activity_id: act2, lead_id: leadId, path: `${leadId}/${act2}/v.mp4`, name: "v.mp4", mime: "video/mp4", size: 10 });
    expect(badMime.error?.code).toBe("23514");
    const tooBig = await admin!.from("activity_attachments").insert({ activity_id: act2, lead_id: leadId, path: `${leadId}/${act2}/big.png`, name: "big.png", mime: "image/png", size: 10 * 1024 * 1024 + 1 });
    expect(tooBig.error?.code).toBe("23514");
  }, 60_000);

  it("CA-S1-20: sem login o anexo é negado; logado, abre", async () => {
    const leadId = await newLead("TESTE PRIVADO (apagar)");
    const actId = await newActivity(leadId, "privado");
    const { path } = await uploadPng(leadId, actId, "privado.png");

    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const dl = await anon.storage.from(ATTACHMENTS_BUCKET).download(path);
    expect(dl.error).not.toBeNull();
    const pub = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${ATTACHMENTS_BUCKET}/${path}`);
    expect(pub.status).toBeGreaterThanOrEqual(400);

    const u = await createTempUser(admin!, "ca20"); users.push(u);
    const jwt = await signInJwt(u);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const ok = await asUser.storage.from(ATTACHMENTS_BUCKET).download(path);
    expect(ok.error).toBeNull();
  }, 60_000);

  it("CA-S1-21: apagar o lead apaga atividades, registros de anexo e os objetos do bucket", async () => {
    const leadId = await newLead("TESTE CASCATA (apagar)");
    const actId = await newActivity(leadId, "cascata");
    const { path } = await uploadPng(leadId, actId, "cascata.png");

    const before = await admin!.storage.from(ATTACHMENTS_BUCKET).list(`${leadId}/${actId}`);
    expect((before.data ?? []).some((o) => `${leadId}/${actId}/${o.name}` === path)).toBe(true);

    const del = await admin!.from("leads").delete().eq("id", leadId);
    expect(del.error).toBeNull();

    const { count: acts } = await admin!.from("activities").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
    const { count: atts } = await admin!.from("activity_attachments").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
    expect(acts).toBe(0);
    expect(atts).toBe(0);
    expect(await waitUntilGone(`${leadId}/${actId}`)).toBe(0);
    const dl = await admin!.storage.from(ATTACHMENTS_BUCKET).download(path);
    expect(dl.error).not.toBeNull();
  }, 60_000);
});
