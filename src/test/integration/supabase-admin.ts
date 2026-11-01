// Helpers dos testes de integração contra o projeto Supabase (SUP-S1-07).
// Leem o .env local; sem credenciais, os testes são pulados.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...(process.env as Record<string, string>) };
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return out;
  for (const raw of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    const v = rest.join("=").trim().replace(/^"|"$/g, "");
    if (!(k.trim() in out)) out[k.trim()] = v;
  }
  return out;
}

const env = loadEnv();
export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? "";
export const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
export const SERVICE_ROLE = env.SERVICE_ROLE ?? "";

/** true quando há credenciais para falar com o banco. */
export const hasSupabaseCredentials = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE);

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const TEST_EMAIL_DOMAIN = "@teste.com";

export function tempEmail(tag: string): string {
  return `teste-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${TEST_EMAIL_DOMAIN}`;
}

export interface TempUser {
  id: string;
  email: string;
  password: string;
}

/** Cria um usuário temporário já confirmado. Quem cria é responsável por apagar. */
export async function createTempUser(admin: SupabaseClient, tag: string): Promise<TempUser> {
  const email = tempEmail(tag);
  const password = `Tmp-${Math.random().toString(36).slice(2)}-Xy9!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser sem usuário");
  return { id: data.user.id, email, password };
}

export async function deleteTempUser(admin: SupabaseClient, id: string): Promise<void> {
  await admin.auth.admin.deleteUser(id);
}

/** Faz login do usuário temporário e devolve o JWT de sessão. */
export async function signInJwt(user: TempUser): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error || !data.session) throw error ?? new Error("login sem sessão");
  return data.session.access_token;
}

/** Chama uma Edge Function como o usuário (JWT) e devolve status + corpo. */
export async function callFunction(
  name: string,
  jwt: string | null,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: ANON_KEY };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await res.json()) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return { status: res.status, body: parsed };
}
