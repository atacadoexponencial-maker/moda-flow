// Integração contra o projeto Supabase (SUP-S1-07): visões salvas são pessoais.
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt, SUPABASE_URL, ANON_KEY, type TempUser } from "./supabase-admin";
import { serializeFilters, deserializeFilters } from "../../lib/saved-views";
import { EMPTY_FILTERS } from "../../components/leads/LeadsFilters";

const admin = hasSupabaseCredentials ? adminClient() : null;
const users: TempUser[] = [];

async function userClient(u: TempUser) {
  const jwt = await signInJwt(u);
  return createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

describe.skipIf(!hasSupabaseCredentials)("visões salvas — banco", () => {
  afterAll(async () => {
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
    // as visões caem em cascata com o usuário
    const { count } = await admin!.from("saved_views").select("id", { count: "exact", head: true }).in("user_id", users.map((u) => u.id));
    expect(count).toBe(0);
  }, 60_000);

  it("CA-S1-27: salvar uma visão e lê-la de volta devolve os mesmos filtros", async () => {
    const a = await createTempUser(admin!, "ca27"); users.push(a);
    const asA = await userClient(a);
    const filters = { ...EMPTY_FILTERS, funil: "workshop", status: "reuniao", assignedTo: "me", dateFrom: new Date(2026, 9, 1), dateTo: new Date(2026, 9, 31) };
    const ins = await asA.from("saved_views").insert({ user_id: a.id, page: "pipeline", name: "Workshop quente", filters: serializeFilters(filters) }).select("id").single();
    expect(ins.error).toBeNull();
    const { data } = await asA.from("saved_views").select("name, filters").eq("id", ins.data!.id).single();
    expect(data?.name).toBe("Workshop quente");
    expect(deserializeFilters(data?.filters)).toEqual(filters);
  }, 60_000);

  it("CA-S1-29: a visão de um usuário não aparece para outro (nem pode ser alterada por ele)", async () => {
    const a = await createTempUser(admin!, "ca29a"); users.push(a);
    const b = await createTempUser(admin!, "ca29b"); users.push(b);
    const asA = await userClient(a);
    const asB = await userClient(b);
    const ins = await asA.from("saved_views").insert({ user_id: a.id, page: "leads", name: "Só minha", filters: serializeFilters(EMPTY_FILTERS) }).select("id").single();
    expect(ins.error).toBeNull();

    const seenByB = await asB.from("saved_views").select("id").eq("page", "leads");
    expect(seenByB.data?.some((v) => v.id === ins.data!.id)).toBe(false);

    const upd = await asB.from("saved_views").update({ name: "hackeada" }).eq("id", ins.data!.id).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const forged = await asB.from("saved_views").insert({ user_id: a.id, page: "leads", name: "forjada", filters: {} });
    expect(forged.error).not.toBeNull();

    const stillA = await asA.from("saved_views").select("name").eq("id", ins.data!.id).single();
    expect(stillA.data?.name).toBe("Só minha");
  }, 60_000);

  it("nome repetido na mesma página é recusado; páginas fora de pipeline/leads também", async () => {
    const a = await createTempUser(admin!, "ca27b"); users.push(a);
    const asA = await userClient(a);
    const first = await asA.from("saved_views").insert({ user_id: a.id, page: "leads", name: "Dup", filters: {} });
    expect(first.error).toBeNull();
    const dup = await asA.from("saved_views").insert({ user_id: a.id, page: "leads", name: "Dup", filters: {} });
    expect(dup.error?.code).toBe("23505");
    const badPage = await asA.from("saved_views").insert({ user_id: a.id, page: "hoje", name: "x", filters: {} });
    expect(badPage.error?.code).toBe("23514");
  }, 60_000);
});
