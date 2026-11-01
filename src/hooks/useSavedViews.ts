import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { LeadsFilterState } from "@/components/leads/LeadsFilters";
import { deserializeFilters, serializeFilters, type SavedView, type ViewPage } from "@/lib/saved-views";

const key = (page: ViewPage) => ["saved-views", page];

/** Visões próprias do usuário logado para a página (RLS garante que só as dele chegam). */
export function useSavedViews(page: ViewPage) {
  const qc = useQueryClient();

  const list = useQuery<SavedView[]>({
    queryKey: key(page),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_views")
        .select("id, name, filters")
        .eq("page", page)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, name: r.name, filters: deserializeFilters(r.filters), builtIn: false }));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key(page) });

  const save = useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: LeadsFilterState }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sem usuário logado");
      const { data, error } = await supabase
        .from("saved_views")
        .insert({ user_id: userId, page, name, filters: serializeFilters(filters) as Json })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("saved_views").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { views: list.data ?? [], isLoading: list.isLoading, save, rename, remove };
}
