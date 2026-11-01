import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "@/lib/team";

export const TEAM_MEMBERS_QUERY_KEY = ["team-members"];

/** Membros do time (via função team_members no banco), compartilhado entre painel, card e tabela. */
export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: TEAM_MEMBERS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("team_members");
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
