# 04: Módulo de teste de conexão (`whatsapp-test-connection`)

**Tipo:** Implementação
**Página/Módulo:** Módulo de Teste de Conexão (`whatsapp-test-connection`)

## Descrição

Criar a Edge Function autenticada que confirma se o número conectado está ativo, lendo o token do Vault e consultando o Meta.

## Checklist de comportamentos

- [x] Exigir autenticação: rejeitar requisição sem usuário autenticado.
- [x] Verificar existência de conexão: retornar erro claro se não houver token/configuração.
- [x] Ler token do Vault a partir do `vault_secret_id`, sem expô-lo na resposta.
- [x] Confirmar número junto ao Meta: consultar status/dados do `phone_number_id` e determinar se está ativo.
- [x] Retornar resultado: sucesso (número ativo, com dados de exibição) ou falha com o motivo retornado pelo Meta.

## Cenários

- **Happy path:** usuário autenticado, `whatsapp_config` com `vault_secret_id` e `phone_number_id`, token válido no Vault, Meta retorna dados do número → `{ success: true, display_phone_number, verified_name }`.
- **Sem autenticação:** sem header `Authorization: Bearer` ou `getUser()` falha → `401 { error: "Unauthorized" }`.
- **Sem conexão:** `whatsapp_config` ausente ou sem `vault_secret_id`/`phone_number_id` → `400 { error: "Nenhum número conectado" }`.
- **Falha ao ler Vault:** `vault_read_secret` retorna erro/nulo → `500 { error: "Falha ao ler token do Vault" }`.
- **Token inválido / número inativo:** Meta responde com `error` → `200 { success: false, error: <message do Meta> }`.
- **Erro inesperado:** exceção não tratada → `500 { error: "Erro interno" }`.

## Arquivos

- `supabase/functions/whatsapp-test-connection/index.ts` (novo) — Edge Function espelhando `meta-test-connection`, adaptada para `whatsapp_config` e confirmação do número via `phone_number_id`.

Reuso (sem modificar): tabela `whatsapp_config` (`vault_secret_id`, `phone_number_id`) da migration `20260620000000_whatsapp_config.sql`; RPC `vault_read_secret`; padrões `corsHeaders`, `jsonResponse`, `GRAPH_VERSION` das funções `whatsapp-signup-*`.

## Checklist refinado

- [x] CORS + tratamento de `OPTIONS`.
- [x] `Authorization: Bearer` obrigatório + `getUser()` (userClient com anon key).
- [x] `adminClient` (service role) lê `whatsapp_config` → `vault_secret_id`, `phone_number_id`.
- [x] Se faltar `vault_secret_id` (ou `phone_number_id`) → `400 { error: "Nenhum número conectado" }`.
- [x] Ler token via `rpc("vault_read_secret", { secret_id })`; erro → `500`.
- [x] `GET graph.facebook.com/v21.0/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating&access_token=...`.
- [x] Resposta com `error` → `{ success: false, error: <message> }`; senão `{ success: true, display_phone_number, verified_name }`.
- [x] Nunca expor o token na resposta.

## Notas

- Espelhar `supabase/functions/meta-test-connection`.
- Deploy via Lovable (incluir prompt Lovable).
