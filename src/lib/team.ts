// Regras puras de exibição do responsável pelo lead e do botão "Assumir".
// A gravação, o histórico e a remoção em cascata ficam no banco (migration
// 20261101140000_lead_assigned_to.sql).

export interface TeamMember {
  user_id: string;
  email: string;
  role: string;
}

/** Nome curto a partir do e-mail: parte antes do @, com a primeira letra maiúscula em cada pedaço. */
export function displayName(email: string | null | undefined): string {
  if (!email) return "";
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Iniciais para o card: duas letras (duas partes do nome, ou as duas primeiras letras). */
export function initials(email: string | null | undefined): string {
  if (!email) return "";
  const parts = (email.split("@")[0] ?? "").split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export const UNASSIGNED_LABEL = "Sem responsável";

/** Rótulo do responsável para tabela/painel; "Sem responsável" quando vazio ou desconhecido. */
export function assigneeLabel(members: TeamMember[], assignedTo: string | null | undefined): string {
  if (!assignedTo) return UNASSIGNED_LABEL;
  const m = members.find((x) => x.user_id === assignedTo);
  return m ? displayName(m.email) : UNASSIGNED_LABEL;
}

/** Iniciais do responsável de um lead, ou "" se não houver. */
export function assigneeInitials(members: TeamMember[], assignedTo: string | null | undefined): string {
  if (!assignedTo) return "";
  const m = members.find((x) => x.user_id === assignedTo);
  return m ? initials(m.email) : "";
}

/** "Assumir" aparece quando há usuário logado e o lead ainda não é dele. */
export function canAssume(lead: { assigned_to: string | null }, userId: string | null | undefined): boolean {
  return Boolean(userId) && lead.assigned_to !== userId;
}

/** Patch gravado pelo botão "Assumir". */
export function assignPatch(userId: string): { assigned_to: string } {
  return { assigned_to: userId };
}
