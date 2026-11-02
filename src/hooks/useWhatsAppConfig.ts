import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";

const QUERY_KEY = ["whatsapp_config"];

/** Projeção segura de whatsapp_config (view whatsapp_config_safe): nunca traz o token. */
export interface WhatsAppConfigSafe {
  id: string;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  webhook_subscribed_at: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  token_configurado: boolean;
}

export interface ConnectWhatsAppInput {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
}

interface ServerResult {
  success: boolean;
  error?: string;
  step?: string;
}

interface TestConnectionResponse extends ServerResult {
  display_phone_number?: string | null;
  verified_name?: string | null;
  quality_rating?: string | null;
}

/** Lê o estado da conexão via projeção segura. Retorna null quando não há linha de config. */
export function useWhatsAppConfig() {
  return useQuery<WhatsAppConfigSafe | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_config_safe").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data as WhatsAppConfigSafe | null) ?? null;
    },
  });
}

/** Conecta ou troca o número. A validação na Meta e a gravação do token acontecem no servidor. */
export function useConnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConnectWhatsAppInput) => {
      const { data, error } = await supabase.functions.invoke<ServerResult>("whatsapp-connect", { body: input });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Não foi possível conectar");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Testa a conexão atual. Retorna os dados do número em caso de sucesso. */
export function useTestWhatsAppConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<TestConnectionResponse> => {
      const { data, error } = await supabase.functions.invoke<TestConnectionResponse>("whatsapp-test-connection");
      if (error) throw error;
      if (!data?.success) throw new Error(getErrorMessage(data?.error, "Não foi possível validar a conexão"));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Desconecta o WhatsApp e invalida o estado em cache. */
export function useDisconnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<ServerResult>("whatsapp-disconnect");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha ao desconectar");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
