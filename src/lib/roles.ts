// Regras de apresentação dos papéis na tela de Usuários.
// A autorização de verdade fica no banco (CHECK, triggers, policies) e nas
// Edge Functions (supabase/functions/_shared/authorize.ts); aqui só decidimos
// o que mostrar ou desabilitar.

export const CRM_ROLES = ["proprietario", "admin"] as const;
export type CrmRole = (typeof CRM_ROLES)[number];

export const ROLE_LABELS: Record<CrmRole, string> = {
  proprietario: "Proprietário",
  admin: "Admin",
};

/** Único papel atribuível pela tela: o proprietário não é atribuível. */
export const ROLE_OPTIONS: { value: CrmRole; label: string }[] = [
  { value: "admin", label: ROLE_LABELS.admin },
];

export function isCrmRole(role: unknown): role is CrmRole {
  return typeof role === "string" && (CRM_ROLES as readonly string[]).includes(role);
}

export function roleLabel(role: string | null | undefined): string {
  return isCrmRole(role) ? ROLE_LABELS[role] : "Sem papel";
}

/** Proprietário e admin gerenciam usuários (convidar, trocar papel, remover). */
export function canManageUsers(actorRole: string | null | undefined): boolean {
  return isCrmRole(actorRole);
}

/** O papel do proprietário nunca é editável pela tela. */
export function canEditRole(actorRole: string | null | undefined, targetRole: string | null | undefined): boolean {
  return canManageUsers(actorRole) && targetRole !== "proprietario";
}

/** Ninguém remove o proprietário nem a si mesmo. */
export function canDeleteUser(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
  isSelf: boolean,
): boolean {
  return canManageUsers(actorRole) && targetRole !== "proprietario" && !isSelf;
}
