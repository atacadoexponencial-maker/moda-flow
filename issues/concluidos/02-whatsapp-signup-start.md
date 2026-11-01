# 02: Módulo de início da conexão (geração de state)

**Tipo:** Implementação
**Página/Módulo:** Módulo de Início da Conexão (geração de state)

## Descrição

Criar a Edge Function autenticada que gera e registra um valor de `state` (CSRF) na configuração e devolve ao frontend os dados públicos necessários para abrir o popup do Embedded Signup, sem expor segredos.

## Checklist de comportamentos

- [x] Exigir autenticação: rejeitar requisição sem usuário autenticado.
- [x] Gerar valor de `state` único e imprevisível (ex.: `crypto.randomUUID()`).
- [x] Registrar o `state` em `whatsapp_config.oauth_state`, criando a linha de configuração se ainda não existir.
- [x] Retornar ao frontend o `state` e identificadores públicos do app necessários ao popup (ex.: app_id / config_id de Embedded Signup), sem expor nenhum segredo.

## Cenários

### Happy path
1. Frontend autenticado chama `POST /functions/v1/whatsapp-signup-start` com header `Authorization: Bearer <jwt>`.
2. A função valida o usuário via `userClient.auth.getUser()`.
3. Lê `META_APP_ID` e `WHATSAPP_CONFIG_ID` do ambiente (ambos presentes).
4. Gera `state = crypto.randomUUID()`.
5. Faz upsert em `whatsapp_config.oauth_state` (atualiza a linha existente ou cria a primeira linha).
6. Responde `200` com JSON `{ state, app_id, config_id }` — somente dados públicos.

### Edge cases
- **Nenhuma linha em `whatsapp_config`**: a função cria a primeira linha via `insert({ oauth_state })`.
- **Linha já existente**: atualiza apenas `oauth_state` na linha encontrada (não toca em token/waba_id/etc.).
- **Requisição OPTIONS (preflight CORS)**: responde `200` com os `corsHeaders`, sem corpo.

### Erros
- **Sem header `Authorization: Bearer`** → `401 { error: "Unauthorized" }`.
- **JWT inválido/expirado** (`getUser()` retorna erro) → `401 { error: "Unauthorized" }`.
- **`META_APP_ID` ausente** → `500 { error: "META_APP_ID não configurado" }`.
- **`WHATSAPP_CONFIG_ID` ausente** → `500 { error: "WHATSAPP_CONFIG_ID não configurado" }`.
- **Exceção inesperada** → `500 { error: "Erro interno" }` (logada via `console.error`).

## Arquivos

- `supabase/functions/whatsapp-signup-start/index.ts` (criar) — Edge Function Deno espelhando `meta-oauth-start/index.ts`.

## Variáveis de ambiente

Lidas de `Deno.env` no backend (nunca expostas ao frontend como segredo):

- `SUPABASE_URL` — já existente (injetada pela plataforma).
- `SUPABASE_ANON_KEY` — já existente (injetada pela plataforma).
- `SUPABASE_SERVICE_ROLE_KEY` — já existente (injetada pela plataforma).
- `META_APP_ID` — **já usada** por `meta-oauth-start`; ID público do app Meta. Reaproveitada aqui.
- `WHATSAPP_CONFIG_ID` — **NOVA**; ID da configuração de Embedded Signup do WhatsApp. Valor público (não é segredo), devolvido ao frontend como `config_id`.

## Checklist refinado

- [x] Tratar preflight `OPTIONS` com `corsHeaders` (igual aos outros functions).
- [x] Exigir `Authorization: Bearer` e validar usuário via `userClient.auth.getUser()`.
- [x] Ler `META_APP_ID` e `WHATSAPP_CONFIG_ID`; retornar `500` claro se faltarem.
- [x] Gerar `state = crypto.randomUUID()`.
- [x] Upsert em `whatsapp_config.oauth_state` via service role client (select → update/insert), idêntico ao padrão de `meta_config`.
- [x] Responder `{ state, app_id, config_id }` — nunca token/secret.
- [x] `try/catch` com `console.error` e `500 { error: "Erro interno" }`.

## Notas

- Espelhar `supabase/functions/meta-oauth-start`.
- Segredos (app secret, etc.) ficam em variáveis de ambiente no backend.
- Deploy via Lovable (incluir prompt Lovable).
