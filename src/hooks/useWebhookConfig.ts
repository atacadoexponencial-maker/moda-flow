import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export function useWebhookConfig() {
  return useQuery({
    queryKey: ["webhook_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_configs")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateWebhookConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: TablesUpdate<"webhook_configs">) => {
      const { data: config } = await supabase
        .from("webhook_configs")
        .select("id")
        .single();
      if (!config) throw new Error("No webhook config found");
      const { data, error } = await supabase
        .from("webhook_configs")
        .update(updates)
        .eq("id", config.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook_config"] }),
  });
}
