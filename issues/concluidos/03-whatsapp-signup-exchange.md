# 03: Módulo de troca de código (`whatsapp-signup-exchange`)

**Tipo:** Implementação
**Página/Módulo:** Módulo de Troca de Código (`whatsapp-signup-exchange`)

## Descrição

Criar a Edge Function autenticada que recebe o retorno do Embedded Signup, valida o estado, troca o código por token permanente, inscreve o app no WABA, descobre os dados do número, guarda o token no Vault e persiste a configuração.

## Checklist de comportamentos

- [x] Exigir autenticação: rejeitar requisição sem usuário autenticado.
- [x] Validar entrada: rejeitar se faltar `code`, `waba_id` ou `phone_number_id`.
- [x] Validar `state` (CSRF): comparar com `whatsapp_config.oauth_state`; rejeitar se não corresponder.
- [x] Trocar `code` por token permanente de System User junto ao Meta.
- [x] Inscrever o app no WABA (subscribed_apps) para habilitar futuros eventos.
- [x] Descobrir dados do número: `display_phone_number` e `verified_name` a partir do `phone_number_id`.
- [x] Guardar token no Vault e obter `vault_secret_id`; nunca retornar o token ao frontend.
- [x] Persistir configuração: gravar identificadores, número, nome verificado e `vault_secret_id`; marcar `ativo = true` e limpar `oauth_state`.
- [x] Tratar erros explicitamente: em qualquer falha, retornar erro claro sem expor segredos e sem deixar a configuração inconsistente.

## Notas

- Espelhar `supabase/functions/meta-oauth-callback` e `meta-save-config`.
- Reutilizar o helper de upsert do Vault (`vault_upsert_secret`, migration `20260428000001`).
- Deploy via Lovable (incluir prompt Lovable).

## Padrão Documentado

Versão da Graph API usada: **v21.0** (versão estável e suportada; o restante do projeto usa v19.0, mas o WhatsApp Embedded Signup é recomendado em v21+). Confirmado na doc oficial do Meta e nas coleções oficiais (Postman da Meta).

1. **Troca do `code` por token permanente** (Business Integration System User access token):
   - `GET https://graph.facebook.com/v21.0/oauth/access_token?client_id={META_APP_ID}&client_secret={META_APP_SECRET}&code={code}`
   - **NÃO enviar `redirect_uri`** — diferente do OAuth de login (Facebook Login). No Embedded Signup o code já está vinculado ao app via SDK; enviar `redirect_uri` causa erro.
   - O token retornado é **permanente** (não expira). NÃO trocar por long-lived (`fb_exchange_token`) e NÃO gravar `token_expires_at` (a tabela `whatsapp_config` nem possui essa coluna).
   - Fonte: developers.facebook.com — "Access Tokens" / "Embedded Signup → Manage accounts" (Business Integration System User tokens). Busca confirmou: exchange via `oauth/access_token` com `client_id`, `client_secret`, `code`, sem `redirect_uri`.

2. **Inscrição do app no WABA (subscribed_apps)** — habilita webhooks/eventos futuros:
   - `POST https://graph.facebook.com/v21.0/{waba_id}/subscribed_apps`
   - Header: `Authorization: Bearer {token obtido no passo 1}`.
   - Fonte: developers.facebook.com — "WABAs / Embedded Signup → Manage accounts"; coleção oficial Postman da Meta ("Subscribe app to WABA's webhooks").

3. **Descoberta dos dados do número:**
   - `GET https://graph.facebook.com/v21.0/{phone_number_id}?fields=display_phone_number,verified_name`
   - Header: `Authorization: Bearer {token}` (ou `access_token` na query — usaremos o header Bearer).
   - Fonte: developers.facebook.com — "Phone Numbers" reference (campos `display_phone_number`, `verified_name`).

## Cenários

**Happy path:**
1. Frontend envia `{ code, waba_id, phone_number_id, state }` com `Authorization: Bearer <jwt>`.
2. Função valida usuário, valida presença dos campos, valida `state` contra `whatsapp_config.oauth_state`.
3. Troca `code` → token permanente.
4. `POST {waba_id}/subscribed_apps` com o token.
5. `GET {phone_number_id}?fields=...` retorna `display_phone_number` e `verified_name`.
6. Grava token no Vault (`vault_upsert_secret` → `whatsapp_access_token`), obtém `vault_secret_id`.
7. Atualiza `whatsapp_config`: identificadores, número, nome, `vault_secret_id`, `ativo=true`, `oauth_state=null`.
8. Responde `{ success: true }` (sem o token).

**Edge cases / erro:**
- Sem `Authorization` Bearer → 401.
- `getUser()` falha → 401.
- Falta env (`META_APP_ID`, `META_APP_SECRET`, etc.) → 500 com mensagem clara.
- Falta `code`/`waba_id`/`phone_number_id` no body → 400.
- `whatsapp_config` inexistente, sem `oauth_state`, ou `oauth_state !== state` → 400/401 (CSRF). Não prosseguir.
- Erro na troca do token (`tokenData.error`) → 502, log do erro, sem vazar segredo.
- Erro em `subscribed_apps` → 502, sem marcar `ativo`.
- Erro na descoberta do número → 502, sem marcar `ativo`.
- Erro ao gravar no Vault → 500, sem marcar `ativo`.
- Erro ao persistir config → 500.
- `ativo=true` só no UPDATE final, após Vault + dados ok → nunca deixa config inconsistente.

## Arquivos

- **Criar:** `supabase/functions/whatsapp-signup-exchange/index.ts`

## Variáveis de ambiente

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`
- `META_APP_SECRET`

## Checklist refinado

- [x] CORS + tratamento de `OPTIONS` espelhando as demais functions.
- [x] Exigir `Authorization: Bearer` e validar `userClient.auth.getUser()`.
- [x] Ler envs; 500 claro se faltar alguma.
- [x] Body `{ code, waba_id, phone_number_id, state }`; 400 se faltar `code`/`waba_id`/`phone_number_id`.
- [x] Validar CSRF: ler `whatsapp_config` (service role), comparar `oauth_state` com `state`.
- [x] Trocar `code` por token permanente (GET, sem `redirect_uri`); tratar `tokenData.error`.
- [x] `POST {waba_id}/subscribed_apps` com Bearer; tratar erro.
- [x] `GET {phone_number_id}?fields=display_phone_number,verified_name`; tratar erro.
- [x] Gravar token no Vault via `vault_upsert_secret` (`whatsapp_access_token`).
- [x] Update `whatsapp_config`: `vault_secret_id`, `waba_id`, `phone_number_id`, `display_phone_number`, `verified_name`, `ativo=true`, `oauth_state=null`.
- [x] Nunca retornar o token; resposta `{ success: true }`.
- [x] Erros claros sem vazar segredos; `ativo=true` somente ao final.
