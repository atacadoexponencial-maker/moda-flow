// Integração contra o projeto Supabase (SUP-S1-07/SUP-S2-08): permissões da
// configuração do WhatsApp e ausência do token no que o navegador lê.
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, signInJwt, callFunction,
  SUPABASE_URL, ANON_KEY, type TempUser,
} from "./supabase-admin";

const admin = hasSupabaseCredentials ? adminClient() : null;
const users: TempUser[] = [];

describe.skipIf(!hasSupabaseCredentials)("configuração do WhatsApp — permissões", () => {
  afterAll(async () => {
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
  }, 60_000);

  it("CA-S2-05: usuário sem papel não conecta, não testa e não desconecta", async () => {
    const u = await createTempUser(admin!, "s2ca05"); users.push(u);
    await admin!.from("user_roles").delete().eq("user_id", u.id);
    const jwt = await signInJwt(u);

    const before = await admin!.from("whatsapp_config").select("*").limit(1).maybeSingle();

    expect((await callFunction("whatsapp-connect", jwt, { waba_id: "1", phone_number_id: "2", access_token: "x" })).status).toBe(403);
    expect((await callFunction("whatsapp-test-connection", jwt, {})).status).toBe(403);
    expect((await callFunction("whatsapp-disconnect", jwt, {})).status).toBe(403);
    expect((await callFunction("whatsapp-connect", null, {})).status).toBe(401);

    const after = await admin!.from("whatsapp_config").select("*").limit(1).maybeSingle();
    expect(after.data).toEqual(before.data);
  }, 60_000);

  it("CA-S2-01: o que o navegador lê da conexão não contém o token nem a referência ao Vault", async () => {
    const u = await createTempUser(admin!, "s2ca01"); users.push(u);
    const jwt = await signInJwt(u);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });

    const view = await asUser.from("whatsapp_config_safe").select("*").limit(1).maybeSingle();
    expect(view.error).toBeNull();
    const keys = Object.keys(view.data ?? {});
    expect(keys).toContain("token_configurado");
    expect(keys).not.toContain("vault_secret_id");
    expect(keys.some((k) => k.includes("token") && k !== "token_configurado")).toBe(false);

    // a tabela base não é legível pelo navegador
    const base = await asUser.from("whatsapp_config").select("vault_secret_id");
    expect(base.data ?? []).toHaveLength(0);
  }, 60_000);
});
