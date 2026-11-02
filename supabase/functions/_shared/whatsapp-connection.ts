// Regras da conexão manual do número (S2-01). Módulo puro: a Edge Function
// injeta `fetch` e um armazenamento; os testes injetam dublês.
import {
  getPhoneNumberInfo,
  listWabaPhoneIds,
  subscribeAppToWaba,
  type FetchLike,
  type PhoneNumberInfo,
} from "./whatsapp-graph.ts";

export interface ConnectInput {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
}

/** O que a tela pode ver da conexão (nunca o token). */
export interface SafeConnection {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  webhook_subscribed_at: string;
  token_configurado: true;
}

/** Onde a função grava. Só a configuração do número: conversas e mensagens não são tocadas. */
export interface ConnectionStore {
  saveToken(token: string): Promise<string>;
  saveConfig(config: Omit<SafeConnection, "token_configurado"> & { vault_secret_id: string; ativo: true }): Promise<void>;
}

export type ConnectStep = "dados" | "numero" | "conta" | "assinatura" | "gravacao";

export type ConnectResult =
  | { ok: true; connection: SafeConnection }
  | { ok: false; step: ConnectStep; error: string };

const ID_RE = /^\d{5,30}$/;

export function validateConnectInput(input: Partial<ConnectInput>): string | null {
  const waba = (input.waba_id ?? "").trim();
  const phone = (input.phone_number_id ?? "").trim();
  const token = (input.access_token ?? "").trim();
  if (!waba || !phone || !token) return "Preencha WABA, identificador do número e token.";
  if (!ID_RE.test(waba)) return "WABA ID deve conter só números.";
  if (!ID_RE.test(phone)) return "Identificador do número deve conter só números.";
  if (token.length < 20) return "Token muito curto: confira se copiou o token inteiro.";
  return null;
}

/**
 * Conecta (ou troca) o número. Todas as verificações na Meta acontecem ANTES
 * de gravar: se alguma falhar, a configuração anterior permanece como estava.
 */
export async function connectNumber(
  input: Partial<ConnectInput>,
  deps: { fetch: FetchLike; store: ConnectionStore; now?: () => Date },
): Promise<ConnectResult> {
  const invalid = validateConnectInput(input);
  if (invalid) return { ok: false, step: "dados", error: invalid };
  const waba = input.waba_id!.trim();
  const phone = input.phone_number_id!.trim();
  const token = input.access_token!.trim();

  const info = await getPhoneNumberInfo(deps.fetch, token, phone);
  if ("error" in info) return { ok: false, step: "numero", error: `Número: ${info.error.message}` };

  const ids = await listWabaPhoneIds(deps.fetch, token, waba);
  if ("error" in ids) return { ok: false, step: "conta", error: `Conta (WABA): ${ids.error.message}` };
  if (!(ids.data as string[]).includes(phone)) {
    return { ok: false, step: "conta", error: "Esse número não pertence à conta (WABA) informada." };
  }

  const sub = await subscribeAppToWaba(deps.fetch, token, waba);
  if ("error" in sub) return { ok: false, step: "assinatura", error: `Assinatura do webhook: ${sub.error.message}` };

  const safe: SafeConnection = {
    waba_id: waba,
    phone_number_id: phone,
    display_phone_number: info.data.display_phone_number,
    verified_name: info.data.verified_name,
    quality_rating: info.data.quality_rating,
    webhook_subscribed_at: (deps.now ?? (() => new Date()))().toISOString(),
    token_configurado: true,
  };

  try {
    const vaultId = await deps.store.saveToken(token);
    const { token_configurado: _t, ...cfg } = safe;
    await deps.store.saveConfig({ ...cfg, vault_secret_id: vaultId, ativo: true });
  } catch (e) {
    return { ok: false, step: "gravacao", error: `Falha ao gravar a conexão: ${e instanceof Error ? e.message : String(e)}` };
  }

  return { ok: true, connection: safe };
}

export type TestResult =
  | { ok: true; info: Pick<PhoneNumberInfo, "display_phone_number" | "verified_name" | "quality_rating"> }
  | { ok: false; error: string };

/** Testa a conexão atual com o token guardado. */
export async function testConnection(fetchFn: FetchLike, token: string, phoneNumberId: string): Promise<TestResult> {
  const info = await getPhoneNumberInfo(fetchFn, token, phoneNumberId);
  if ("error" in info) return { ok: false, error: info.error.message };
  const { display_phone_number, verified_name, quality_rating } = info.data;
  return { ok: true, info: { display_phone_number, verified_name, quality_rating } };
}

/** Rótulo em português da qualidade do número informada pela Meta. */
export function qualityLabel(q: string | null | undefined): string {
  switch ((q ?? "").toUpperCase()) {
    case "GREEN": return "Alta";
    case "YELLOW": return "Média";
    case "RED": return "Baixa";
    case "": return "—";
    default: return "Desconhecida";
  }
}
