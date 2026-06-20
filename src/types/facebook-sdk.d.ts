// Tipos globais mínimos do Facebook JS SDK usados no fluxo de WhatsApp Embedded Signup.
// Apenas a superfície que consumimos (FB.init e FB.login); não é a tipagem completa do SDK.

interface FBInitParams {
  appId: string;
  version: string;
  cookie?: boolean;
  xfbml?: boolean;
}

interface FBLoginAuthResponse {
  /** Código OAuth de uso único, repassado ao backend (whatsapp-signup-exchange). */
  code?: string;
}

interface FBLoginResponse {
  /** Ausente quando o usuário cancela ou não autoriza o popup. */
  authResponse?: FBLoginAuthResponse | null;
  status?: string;
}

interface FBLoginOptions {
  config_id: string;
  response_type: "code";
  override_default_response_type: boolean;
  extras?: { sessionInfoVersion: string };
}

interface FacebookSDK {
  init(params: FBInitParams): void;
  login(callback: (response: FBLoginResponse) => void, options: FBLoginOptions): void;
}

interface Window {
  FB?: FacebookSDK;
  fbAsyncInit?: () => void;
}
