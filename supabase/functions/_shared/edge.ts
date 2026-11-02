// Utilidades comuns das Edge Functions autenticadas (Deno).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";
import { getCrmRole, type CrmRole } from "./authorize.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export interface Caller {
  admin: SupabaseClient;
  userId: string;
  email: string | null;
  role: CrmRole | null;
}

/**
 * Valida o JWT do chamador e devolve o client service-role e o papel.
 * Retorna uma Response de erro (401) quando não há usuário válido.
 */
export async function authenticate(req: Request): Promise<Caller | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(url, service);
  const role = await getCrmRole(admin, data.user.id);
  return { admin, userId: data.user.id, email: data.user.email ?? null, role };
}

/** Exige papel proprietário ou admin; devolve 403 caso contrário. */
export async function requireCrmRole(req: Request): Promise<Caller | Response> {
  const c = await authenticate(req);
  if (c instanceof Response) return c;
  if (!c.role) return json({ error: "Forbidden" }, 403);
  return c;
}

/** Token do WhatsApp guardado no Vault, a partir da configuração atual. */
export async function readWhatsAppToken(admin: SupabaseClient, vaultSecretId: string | null): Promise<string | null> {
  if (!vaultSecretId) return null;
  const { data, error } = await admin.rpc("vault_read_secret", { secret_id: vaultSecretId });
  if (error || !data) return null;
  return String(data);
}
