import { describe, it, expect } from "vitest";
import { connectNumber, testConnection, qualityLabel, type ConnectionStore } from "../../supabase/functions/_shared/whatsapp-connection";
import { GRAPH } from "../../supabase/functions/_shared/whatsapp-graph";

const TOKEN = "EAAG-token-de-usuario-de-sistema-0123456789";
const WABA = "1111111111";
const PHONE_A = "2222222222";
const PHONE_B = "3333333333";

type Route = { status?: number; body: unknown };

/** Graph API falsa: responde por método + caminho e registra as chamadas. */
function fakeGraph(routes: Record<string, Route>) {
  const calls: Array<{ method: string; path: string; auth: string | null }> = [];
  const fetchFn = async (input: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = input.replace(`${GRAPH}/`, "").split("?")[0];
    const headers = new Headers(init?.headers);
    calls.push({ method, path, auth: headers.get("Authorization") });
    const r = routes[`${method} ${path}`] ?? { status: 404, body: { error: { message: `rota ${method} ${path} não simulada` } } };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
  };
  return { fetchFn, calls };
}

function okRoutes(phone: string): Record<string, Route> {
  return {
    [`GET ${phone}`]: { body: { id: phone, display_phone_number: "+55 11 90000-0000", verified_name: "Sete Aceleradora", quality_rating: "GREEN" } },
    [`GET ${WABA}/phone_numbers`]: { body: { data: [{ id: PHONE_A }, { id: PHONE_B }] } },
    [`POST ${WABA}/subscribed_apps`]: { body: { success: true } },
  };
}

/** Armazenamento em memória: só conhece a configuração do número (nada de conversas). */
function memStore(initial: Record<string, unknown> | null = null) {
  const state = { config: initial ? { ...initial } : null as Record<string, unknown> | null, token: null as string | null, writes: 0 };
  const store: ConnectionStore = {
    async saveToken(t) { state.token = t; state.writes++; return "vault-id-1"; },
    async saveConfig(c) { state.config = { ...c }; state.writes++; },
  };
  return { store, state };
}

describe("conexão manual do número (whatsapp-connect)", () => {
  it("CA-S2-01: com dados válidos a conexão fica ativa, a conta é assinada e o token não volta na resposta", async () => {
    const g = fakeGraph(okRoutes(PHONE_A));
    const m = memStore();
    const r = await connectNumber({ waba_id: WABA, phone_number_id: PHONE_A, access_token: TOKEN }, { fetch: g.fetchFn, store: m.store, now: () => new Date("2026-11-01T12:00:00Z") });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.connection).toMatchObject({
      waba_id: WABA, phone_number_id: PHONE_A, display_phone_number: "+55 11 90000-0000",
      verified_name: "Sete Aceleradora", quality_rating: "GREEN", token_configurado: true,
      webhook_subscribed_at: "2026-11-01T12:00:00.000Z",
    });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(g.calls.some((c) => c.method === "POST" && c.path === `${WABA}/subscribed_apps`)).toBe(true);
    expect(g.calls.every((c) => c.auth === `Bearer ${TOKEN}`)).toBe(true);
    expect(m.state.token).toBe(TOKEN);
    expect(m.state.config).toMatchObject({ ativo: true, vault_secret_id: "vault-id-1", phone_number_id: PHONE_A });
  });

  it("CA-S2-02: token inválido mostra o erro da Meta e não grava nada", async () => {
    const g = fakeGraph({ [`GET ${PHONE_A}`]: { status: 401, body: { error: { message: "Invalid OAuth access token.", code: 190 } } } });
    const before = { waba_id: WABA, phone_number_id: PHONE_B, ativo: true };
    const m = memStore(before);
    const r = await connectNumber({ waba_id: WABA, phone_number_id: PHONE_A, access_token: TOKEN }, { fetch: g.fetchFn, store: m.store });

    expect(r).toEqual({ ok: false, step: "numero", error: "Número: Invalid OAuth access token." });
    expect(m.state.writes).toBe(0);
    expect(m.state.config).toEqual(before);
  });

  it("CA-S2-02: número de outra conta ou falha ao assinar também não grava", async () => {
    const otherWaba = fakeGraph({ ...okRoutes(PHONE_A), [`GET ${WABA}/phone_numbers`]: { body: { data: [{ id: "999" }] } } });
    const m1 = memStore();
    const r1 = await connectNumber({ waba_id: WABA, phone_number_id: PHONE_A, access_token: TOKEN }, { fetch: otherWaba.fetchFn, store: m1.store });
    expect(r1.ok).toBe(false);
    if ("error" in r1) expect(r1.error).toContain("não pertence à conta");
    expect(m1.state.writes).toBe(0);

    const noPerm = fakeGraph({ ...okRoutes(PHONE_A), [`POST ${WABA}/subscribed_apps`]: { status: 403, body: { error: { message: "(#200) Permissions error", code: 200 } } } });
    const m2 = memStore();
    const r2 = await connectNumber({ waba_id: WABA, phone_number_id: PHONE_A, access_token: TOKEN }, { fetch: noPerm.fetchFn, store: m2.store });
    expect(r2).toMatchObject({ ok: false, step: "assinatura" });
    expect(m2.state.writes).toBe(0);

    const m3 = memStore();
    const r3 = await connectNumber({ waba_id: "abc", phone_number_id: PHONE_A, access_token: TOKEN }, { fetch: otherWaba.fetchFn, store: m3.store });
    expect(r3).toMatchObject({ ok: false, step: "dados" });
  });

  it("CA-S2-03: testar a conexão devolve número exibido, nome verificado e qualidade", async () => {
    const g = fakeGraph(okRoutes(PHONE_A));
    const r = await testConnection(g.fetchFn, TOKEN, PHONE_A);
    expect(r).toEqual({ ok: true, info: { display_phone_number: "+55 11 90000-0000", verified_name: "Sete Aceleradora", quality_rating: "GREEN" } });
    expect(qualityLabel("GREEN")).toBe("Alta");
    expect(qualityLabel("YELLOW")).toBe("Média");
    expect(qualityLabel("RED")).toBe("Baixa");

    const bad = fakeGraph({ [`GET ${PHONE_A}`]: { status: 400, body: { error: { message: "Object does not exist" } } } });
    expect(await testConnection(bad.fetchFn, TOKEN, PHONE_A)).toEqual({ ok: false, error: "Object does not exist" });
  });

  it("CA-S2-04: trocar o número só reescreve a configuração (histórico intocado) e passa a usar o número B", async () => {
    const m = memStore({ waba_id: WABA, phone_number_id: PHONE_A, vault_secret_id: "vault-id-1", ativo: true });
    const g = fakeGraph(okRoutes(PHONE_B));
    const r = await connectNumber({ waba_id: WABA, phone_number_id: PHONE_B, access_token: TOKEN }, { fetch: g.fetchFn, store: m.store });
    expect(r.ok).toBe(true);
    expect(m.state.config).toMatchObject({ phone_number_id: PHONE_B, ativo: true });
    // o armazenamento da conexão só tem saveToken/saveConfig: nenhuma conversa ou mensagem é apagada
    expect(Object.keys(m.store).sort()).toEqual(["saveConfig", "saveToken"]);
    expect(m.state.writes).toBe(2);
  });
});
