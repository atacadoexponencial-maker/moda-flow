import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";

const QUERY_KEY = ["whatsapp_config"];
const FB_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const GRAPH_VERSION = "v21.0";
const FB_MESSAGE_ORIGIN = "https://www.facebook.com";

/**
 * Projeção segura de whatsapp_config exposta ao frontend.
 * A view `whatsapp_config_safe` ainda NÃO está em src/integrations/supabase/types.ts
 * (a migration não foi aplicada / os tipos não foram regenerados), por isso definimos
 * a tipagem localmente. O token nunca trafega — apenas `token_configurado` (boolean).
 */
export interface WhatsAppConfigSafe {
  id: string;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  ativo: boolean;
  created_at: string;
  token_configurado: boolean;
}

interface SignupStartResponse {
  state: string;
  app_id: string;
  config_id: string;
}

interface TestConnectionResponse {
  success: boolean;
  display_phone_number?: string | null;
  verified_name?: string | null;
  error?: string;
}

/** Lê o estado da conexão via projeção segura. Retorna null quando não há linha de config. */
export function useWhatsAppConfig() {
  return useQuery<WhatsAppConfigSafe | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      // A view não existe nos tipos gerados; usamos `as never` para o cliente tipado
      // aceitar o nome da view sem que tenhamos de editar types.ts (gerado automaticamente).
      const { data, error } = await supabase
        .from("whatsapp_config_safe" as never)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as WhatsAppConfigSafe | null) ?? null;
    },
  });
}

/** Garante que o Facebook JS SDK esteja carregado e inicializado com o app_id. */
function ensureFbSdk(appId: string): Promise<FacebookSDK> {
  return new Promise((resolve, reject) => {
    const init = () => {
      if (!window.FB) {
        reject(new Error("Facebook SDK indisponível"));
        return;
      }
      window.FB.init({ appId, version: GRAPH_VERSION, cookie: true, xfbml: true });
      resolve(window.FB);
    };

    if (window.FB) {
      init();
      return;
    }

    window.fbAsyncInit = init;

    const existing = document.getElementById("facebook-jssdk") as HTMLScriptElement | null;
    if (existing) {
      // Script já presente mas ainda carregando; fbAsyncInit cuidará da init.
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.src = FB_SDK_SRC;
    script.onerror = () => reject(new Error("Falha ao carregar o Facebook SDK"));
    document.body.appendChild(script);
  });
}

/**
 * Abre o Embedded Signup e resolve com { code, waba_id, phone_number_id }.
 * - `code` vem do callback de FB.login (OAuth).
 * - `waba_id`/`phone_number_id` vêm do evento `message` (WA_EMBEDDED_SIGNUP).
 * Rejeita se o usuário cancelar o popup.
 */
function runEmbeddedSignup(
  fb: FacebookSDK,
  configId: string
): Promise<{ code: string; waba_id: string; phone_number_id: string }> {
  return new Promise((resolve, reject) => {
    let sessionWabaId: string | null = null;
    let sessionPhoneNumberId: string | null = null;

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== FB_MESSAGE_ORIGIN) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.data?.phone_number_id) sessionPhoneNumberId = data.data.phone_number_id;
        if (data.data?.waba_id) sessionWabaId = data.data.waba_id;
      } catch {
        // Mensagens não-JSON do SDK são ignoradas.
      }
    };

    const cleanup = () => window.removeEventListener("message", messageHandler);

    window.addEventListener("message", messageHandler);

    fb.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          cleanup();
          reject(new Error("Conexão cancelada"));
          return;
        }
        cleanup();
        if (!sessionWabaId || !sessionPhoneNumberId) {
          reject(new Error("Não foi possível obter os dados do número"));
          return;
        }
        resolve({ code, waba_id: sessionWabaId, phone_number_id: sessionPhoneNumberId });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: "3" },
      }
    );
  });
}

/**
 * Fluxo completo de conexão: start → SDK → popup → exchange.
 * Toda lógica de credenciais/token fica no backend; aqui só capturamos code/ids.
 */
export function useConnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // 1) Início: state (CSRF), app_id e config_id
      const { data: start, error: startError } = await supabase.functions.invoke<SignupStartResponse>(
        "whatsapp-signup-start"
      );
      if (startError) throw startError;
      if (!start?.state || !start?.app_id || !start?.config_id) {
        throw new Error("Resposta inválida do servidor");
      }

      // 2) SDK carregado/inicializado
      const fb = await ensureFbSdk(start.app_id);

      // 3+4+5) Popup → code + ids
      const { code, waba_id, phone_number_id } = await runEmbeddedSignup(fb, start.config_id);

      // 6) Troca no backend (com o state para validação CSRF)
      const { data: exchange, error: exchangeError } = await supabase.functions.invoke(
        "whatsapp-signup-exchange",
        { body: { code, waba_id, phone_number_id, state: start.state } }
      );
      if (exchangeError) throw exchangeError;
      if ((exchange as { error?: string } | null)?.error) {
        throw new Error("Falha ao concluir a conexão");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Testa a conexão atual. Retorna os dados do número em caso de sucesso. */
export function useTestWhatsAppConnection() {
  return useMutation({
    mutationFn: async (): Promise<TestConnectionResponse> => {
      const { data, error } = await supabase.functions.invoke<TestConnectionResponse>(
        "whatsapp-test-connection"
      );
      if (error) throw error;
      if (!data?.success) {
        throw new Error(getErrorMessage(data?.error, "Não foi possível validar a conexão"));
      }
      return data;
    },
  });
}

/** Desconecta o WhatsApp e invalida o estado em cache. */
export function useDisconnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-disconnect");
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error("Falha ao desconectar");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
