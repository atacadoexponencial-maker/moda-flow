// Chamadas à Graph API do WhatsApp Cloud API usadas pelas Edge Functions.
// Módulo puro: recebe `fetch` por parâmetro (testável com Vitest, sem Deno).
// Referência: docs/referencia/porte-whatsapp-crm-exponencial.md

export const GRAPH_VERSION = "v26.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface MetaError {
  message: string;
  code?: number;
}

export type GraphResult<T> = { ok: true; data: T } | { ok: false; error: MetaError };

async function graph<T>(
  fetchFn: FetchLike,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<GraphResult<T>> {
  let res: Response;
  try {
    res = await fetchFn(`${GRAPH}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch (e) {
    return { ok: false, error: { message: `Falha de rede ao falar com a Meta: ${e instanceof Error ? e.message : String(e)}` } };
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const err = body.error as { message?: string; code?: number; error_user_msg?: string } | undefined;
  if (!res.ok || err) {
    return {
      ok: false,
      error: { message: err?.error_user_msg || err?.message || `Erro ${res.status} da Meta`, code: err?.code },
    };
  }
  return { ok: true, data: body as T };
}

export interface PhoneNumberInfo {
  id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
}

/** Dados do número (valida token e permissão sobre o número). */
export async function getPhoneNumberInfo(fetchFn: FetchLike, token: string, phoneNumberId: string) {
  const r = await graph<Partial<PhoneNumberInfo>>(
    fetchFn,
    token,
    `${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`,
  );
  if (!r.ok) return r;
  return {
    ok: true as const,
    data: {
      id: String(r.data.id ?? phoneNumberId),
      display_phone_number: r.data.display_phone_number ?? null,
      verified_name: r.data.verified_name ?? null,
      quality_rating: r.data.quality_rating ?? null,
    },
  };
}

/** Lista os ids de número da WABA (para confirmar que o número pertence à conta). */
export async function listWabaPhoneIds(fetchFn: FetchLike, token: string, wabaId: string) {
  const r = await graph<{ data?: Array<{ id: string }> }>(
    fetchFn,
    token,
    `${encodeURIComponent(wabaId)}/phone_numbers?fields=id&limit=100`,
  );
  if (!r.ok) return r;
  return { ok: true as const, data: (r.data.data ?? []).map((p) => String(p.id)) };
}

/** Assina o app do token aos eventos da WABA (mensagens e status). */
export async function subscribeAppToWaba(fetchFn: FetchLike, token: string, wabaId: string) {
  return graph<{ success?: boolean }>(fetchFn, token, `${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST" });
}

/** Remove a assinatura do app do token na WABA (melhor esforço ao desconectar). */
export async function unsubscribeAppFromWaba(fetchFn: FetchLike, token: string, wabaId: string) {
  return graph<{ success?: boolean }>(fetchFn, token, `${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "DELETE" });
}
