// Integração contra o projeto Supabase (SUP-S1-07): cria usuários temporários
// @teste.com, exercita as regras de papéis e apaga tudo ao final.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabaseCredentials,
  adminClient,
  createTempUser,
  deleteTempUser,
  signInJwt,
  callFunction,
  type TempUser,
} from "./supabase-admin";

const admin = hasSupabaseCredentials ? adminClient() : null;
const created: TempUser[] = [];

async function newUser(tag: string): Promise<TempUser> {
  const u = await createTempUser(admin!, tag);
  created.push(u);
  return u;
}

describe.skipIf(!hasSupabaseCredentials)("papéis de usuário — banco e Edge Functions", () => {
  let ownerId = "";

  beforeAll(async () => {
    const { data } = await admin!.from("user_roles").select("user_id").eq("role", "proprietario");
    ownerId = data?.[0]?.user_id ?? "";
  }, 30_000);

  afterAll(async () => {
    for (const u of created) {
      try {
        await deleteTempUser(admin!, u.id);
      } catch {
        /* melhor esforço de limpeza */
      }
    }
    const { data: leftovers } = await admin!.auth.admin.listUsers({ perPage: 200 });
    const remaining = (leftovers?.users ?? []).filter((u) => created.some((c) => c.id === u.id));
    expect(remaining).toHaveLength(0);
  }, 60_000);

  it("CA-S1-01: só existem os papéis proprietario e admin", async () => {
    const u = await newUser("ca01");
    // o trigger já criou 'admin' para ele; trocamos para valores inválidos
    const vendedor = await admin!.from("user_roles").update({ role: "vendedor" }).eq("user_id", u.id);
    expect(vendedor.error?.code).toBe("23514");
    const acento = await admin!.from("user_roles").update({ role: "proprietário" }).eq("user_id", u.id);
    expect(acento.error?.code).toBe("23514");
    const ok = await admin!.from("user_roles").update({ role: "admin" }).eq("user_id", u.id).select("role").single();
    expect(ok.error).toBeNull();
    expect(ok.data?.role).toBe("admin");
  }, 30_000);

  it("CA-S1-02: a conta atual vira a proprietária", async () => {
    const { data: owners } = await admin!.from("user_roles").select("user_id, created_at").eq("role", "proprietario");
    expect(owners).toHaveLength(1);
    const { data: users } = await admin!.auth.admin.listUsers({ perPage: 200 });
    const oldest = [...(users?.users ?? [])]
      .filter((u) => !created.some((c) => c.id === u.id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    expect(owners?.[0].user_id).toBe(oldest.id);
  }, 30_000);

  it("CA-S1-03: proprietário não pode ser removido nem rebaixado", async () => {
    expect(ownerId).not.toBe("");
    const upd = await admin!.from("user_roles").update({ role: "admin" }).eq("user_id", ownerId);
    expect(upd.error?.message).toContain("proprietário não pode ser alterado");
    const del = await admin!.from("user_roles").delete().eq("user_id", ownerId);
    expect(del.error?.message).toContain("proprietário não pode ser alterado");

    const adminUser = await newUser("ca03");
    const jwt = await signInJwt(adminUser);
    const res = await callFunction("manage-users", jwt, { action: "delete", user_id: ownerId });
    expect(res.status).toBe(403);
    expect(String(res.body.error)).toContain("proprietário");

    const { data: still } = await admin!.from("user_roles").select("role").eq("user_id", ownerId).single();
    expect(still?.role).toBe("proprietario");
  }, 30_000);

  it("CA-S1-04: convidado entra como admin automaticamente", async () => {
    const u = await newUser("ca04");
    const { data } = await admin!.from("user_roles").select("role").eq("user_id", u.id).maybeSingle();
    expect(data?.role).toBe("admin");
  }, 30_000);

  it("CA-S1-05: gestão de usuários aceita proprietário e admin e recusa quem não tem papel", async () => {
    const adminUser = await newUser("ca05-admin");
    const adminJwt = await signInJwt(adminUser);
    const asAdmin = await callFunction("manage-users", adminJwt, { action: "list" });
    expect(asAdmin.status).toBe(200);
    const listed = asAdmin.body.users as Array<{ id: string; role: string | null }>;
    expect(listed.find((x) => x.id === adminUser.id)?.role).toBe("admin");

    const noRole = await newUser("ca05-semrole");
    await admin!.from("user_roles").delete().eq("user_id", noRole.id);
    const noRoleJwt = await signInJwt(noRole);
    expect((await callFunction("manage-users", noRoleJwt, { action: "list" })).status).toBe(403);
    expect((await callFunction("clear-crm", noRoleJwt, {})).status).toBe(403);
    expect((await callFunction("manage-users", null, { action: "list" })).status).toBe(401);
  }, 60_000);
});
