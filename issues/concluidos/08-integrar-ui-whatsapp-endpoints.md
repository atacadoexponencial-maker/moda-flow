# 08: Integração da UI com os endpoints (conectar/testar/desconectar)

**Tipo:** Implementação
**Página/Módulo:** Página de Configuração do WhatsApp (`/configuracoes/whatsapp`)

## Descrição

Conectar a página `/configuracoes/whatsapp` (protótipo da issue 07) ao backend: ler o estado via projeção segura e disparar o fluxo de Embedded Signup e as operações de testar/desconectar.

## Checklist de comportamentos

- [ ] Carregar estado da conexão: ler `whatsapp_config_safe` via React Query e exibir estado conectado/desconectado (número, nome verificado, identificadores, ativo) — nunca o token.
- [ ] Iniciar conexão: ao clicar "Conectar WhatsApp", chamar o módulo de início (issue 02) para obter o `state` e abrir o popup oficial de Embedded Signup do Meta.
- [ ] Proteger contra CSRF: enviar o `state` ao Meta e repassá-lo no retorno para validação no backend.
- [ ] Capturar retorno do popup: obter `waba_id`, `phone_number_id` e `code`.
- [ ] Enviar ao backend: chamar `whatsapp-signup-exchange` (issue 03) com `code`, `waba_id`, `phone_number_id` e `state`, sem manipular token.
- [ ] Tratar cancelamento/erro do popup: exibir toast de falha amigável e manter estado desconectado.
- [ ] Exibir sucesso de conexão: invalidar a query e atualizar para o estado conectado com toast de sucesso.
- [ ] Testar conexão: chamar `whatsapp-test-connection` (issue 04) e exibir sucesso (número ativo) ou erro com o motivo.
- [ ] Desconectar: chamar `whatsapp-disconnect` (issue 05), invalidar a query, voltar ao estado desconectado com toast de confirmação.
- [ ] Refletir indisponibilidade: exibir erros retornados pelo backend sem expor detalhes sensíveis.

## Notas

- Thin client: nenhuma lógica de negócio, validação de token ou autorização no frontend.
- Reutilizar `useToast`, padrão de mutations React Query e o cliente Supabase existente.
- Depende das issues 01–05 e do protótipo 07.

## Padrão Documentado

Fluxo de **WhatsApp Embedded Signup** no navegador (Meta for Developers). Fonte:
`https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation`
(confirmado também por implementação de referência pública em
`https://github.com/Gaurang200/whatsapp-embedded-signup`).

O backend já cuida de tudo que envolve segredo (troca de `code` por token, Vault,
assinatura de webhook). O frontend apenas:

1. **Carrega o Facebook JS SDK** uma única vez:
   `<script async defer src="https://connect.facebook.net/en_US/sdk.js">`.
   Após carregar, inicializa com o `app_id` retornado pelo backend:
   ```js
   window.FB.init({ appId, version: "v21.0", cookie: true, xfbml: true });
   ```
2. **Registra um listener de `message`** no `window` para capturar o `phone_number_id`
   e o `waba_id` emitidos pelo popup oficial do Meta:
   ```js
   window.addEventListener("message", (event) => {
     if (event.origin !== "https://www.facebook.com") return;
     const data = JSON.parse(event.data); // pode não ser JSON; envolver em try/catch
     if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
       const { phone_number_id, waba_id } = data.data;
     }
   });
   ```
3. **Chama `FB.login`** para abrir o popup e obter o `code` (OAuth) no callback:
   ```js
   FB.login(
     (response) => {
       if (response.authResponse) {
         const code = response.authResponse.code; // enviar ao backend
       } else {
         // usuário cancelou ou não autorizou → manter desconectado
       }
     },
     {
       config_id,                          // do backend (whatsapp-signup-start)
       response_type: "code",
       override_default_response_type: true,
       extras: { sessionInfoVersion: "3" },
     }
   );
   ```
4. **Combina** o `code` (do callback) com `phone_number_id` + `waba_id` (do evento `message`)
   e envia ao `whatsapp-signup-exchange` junto com o `state` (CSRF) recebido no início.

Notas de implementação:
- O `code` e os ids chegam por canais distintos e em ordem não garantida — guardar ambos
  e só chamar o exchange quando os três (`code`, `phone_number_id`, `waba_id`) estiverem presentes.
- Nunca há token/segredo no frontend; o `code` é descartável e só serve ao backend.

## Cenários

- **Happy path:** start → SDK carregado → popup → evento `WA_EMBEDDED_SIGNUP` com ids +
  callback com `code` → exchange `{ success: true }` → invalida query → toast de sucesso →
  estado conectado.
- **Cancelar popup:** `FB.login` retorna sem `authResponse` → toast amigável "Conexão cancelada" →
  permanece desconectado (nenhuma chamada ao exchange).
- **Erro em `whatsapp-signup-start`** (ex.: `META_APP_ID`/`WHATSAPP_CONFIG_ID` ausentes):
  toast de erro, nada abre.
- **Falha ao carregar o FB SDK** (rede/bloqueio): toast de erro, permanece desconectado.
- **Erro em `whatsapp-signup-exchange`** (CSRF inválido, falha na troca de token): toast de erro
  genérico (sem detalhes sensíveis), permanece desconectado.
- **Erro em `whatsapp-test-connection`** (`success:false`): toast de erro com o motivo retornado.
- **Erro em `whatsapp-disconnect`:** toast de erro; estado não muda.

## Arquivos

- `src/hooks/useWhatsAppConfig.ts` — **novo**. `useWhatsAppConfig` (useQuery na view
  `whatsapp_config_safe`) + mutations `useConnectWhatsApp`, `useTestWhatsAppConnection`,
  `useDisconnectWhatsApp`. Concentra a lógica de SDK/`FB.login` e as chamadas às Edge Functions.
- `src/types/facebook-sdk.d.ts` — **novo**. Tipos globais de `window.FB` e `window.fbAsyncInit`.
- `src/pages/WhatsAppConfigPage.tsx` — **modificado**. Substitui o mock por estado real do hook,
  spinners `isPending`, e handlers que disparam as mutations.

## Checklist refinado

- [x] `useQuery` lendo `whatsapp_config_safe` com tipagem local `WhatsAppConfigSafe`
      (a view ainda não está em `types.ts`; query feita com cast controlado, sem editar `types.ts`).
- [x] Mutation de conexão: start → SDK init → listener `message` → `FB.login` → exchange.
- [x] Tratamento de cancelamento/erro do popup com toast amigável.
- [x] Mutation de teste de conexão exibindo `display_phone_number`/`verified_name` ou erro.
- [x] Mutation de desconexão invalidando a query e com toast.
- [x] Estado real (conectado/desconectado) renderizado a partir do `useQuery`.
- [x] Spinners reais (`isPending`) nos botões; erros via toast sem detalhes sensíveis.
- [x] Tipos globais do FB SDK declarados em `.d.ts` local.
- [x] `npm run lint` e `npx tsc --noEmit` passam nos arquivos tocados.
