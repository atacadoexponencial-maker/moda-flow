import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TemplateComponent } from "../../supabase/functions/_shared/whatsapp-templates";

export interface WhatsAppTemplate {
  id: string;
  meta_id: string;
  name: string;
  language: string;
  category: string | null;
  status: string;
  rejected_reason: string | null;
  components: TemplateComponent[];
  synced_at: string;
}

export const TEMPLATES_QUERY_KEY = ["whatsapp-templates"];

export function useWhatsAppTemplates() {
  return useQuery<WhatsAppTemplate[]>({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_templates").select("*").order("name").order("language");
      if (error) throw error;
      return (data ?? []) as unknown as WhatsAppTemplate[];
    },
  });
}

export function useSyncWhatsAppTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; count?: number; error?: string }>("whatsapp-templates-sync");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha ao sincronizar");
      return data.count ?? 0;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY }),
  });
}
