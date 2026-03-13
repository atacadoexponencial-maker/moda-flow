import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWebhookConfig() {
  return useQuery({
    queryKey: ["webhook_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_configs" as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpdateWebhookConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { data: config } = await supabase
        .from("webhook_configs" as any)
        .select("id")
        .single();
      if (!config) throw new Error("No webhook config found");
      const { data, error } = await supabase
        .from("webhook_configs" as any)
        .update(updates)
        .eq("id", (config as any).id)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook_config"] }),
  });
}
