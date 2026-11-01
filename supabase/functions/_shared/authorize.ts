// Autorização compartilhada das Edge Functions privilegiadas.
// Módulo puro (sem Deno, sem import do supabase-js) para poder ser testado
// com Vitest; recebe o client já criado com a service role.

export const CRM_ROLES = ["proprietario", "admin"] as const;
export type CrmRole = (typeof CRM_ROLES)[number];

export function isCrmRole(role: unknown): role is CrmRole {
  return typeof role === "string" && (CRM_ROLES as readonly string[]).includes(role);
}

/** Subconjunto do client do Supabase usado aqui (compatível com supabase-js). */
export interface RoleLookupClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: { role?: unknown } | null; error: unknown }>;
      };
    };
  };
}

/**
 * Devolve o papel do usuário no CRM ('proprietario' | 'admin') ou null quando
 * ele não tem papel válido ou a consulta falha. Quem chama decide o 403.
 */
export async function getCrmRole(client: RoleLookupClient, userId: string): Promise<CrmRole | null> {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return isCrmRole(data.role) ? data.role : null;
}
