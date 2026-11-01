# 01: meta-save-config — Salvar token no Vault

**Tipo:** Implementação
**Módulo:** meta-save-config

## Descrição

Atualizar a Edge Function `meta-save-config` para armazenar o access_token no Vault criptografado do Supabase em vez de gravá-lo em texto puro na coluna `access_token` da tabela `meta_config`.

## Comportamentos

- Verificar existência de registro: ao receber uma requisição de salvamento, verificar se já existe uma linha em `meta_config`.
- Verificar vault_secret_id existente: se já existir uma linha com `vault_secret_id` preenchido, atualizar o secret existente no Vault usando `vault_update_secret` com o novo token.
- Criar novo secret no Vault: se não existir `vault_secret_id`, criar um novo secret no Vault usando `vault_create_secret` com o valor do token e um nome identificador (ex.: `meta_access_token`).
- Gravar vault_secret_id na tabela: após criar ou atualizar o secret, salvar o UUID retornado na coluna `vault_secret_id` da linha correspondente em `meta_config`.
- Nunca gravar o token em texto puro: a coluna `access_token` não deve ser preenchida com o valor do token em nenhuma circunstância.
- Salvar demais campos normalmente: `ad_account_id` e `ativo` continuam sendo salvos diretamente na tabela, sem alteração de comportamento.
- Retornar sucesso ou erro: responder com `{ success: true }` em caso de êxito, ou mensagem de erro adequada em caso de falha.

---

## Cenários

### Happy Path

1. Frontend envia `POST` com `{ access_token, ad_account_id, ativo }` no body e JWT no header `Authorization`.
2. A função valida o JWT via `userClient.auth.getUser()` — sucesso.
3. A função faz `SELECT id, vault_secret_id FROM meta_config LIMIT 1` via `adminClient`.
4. **Caso A — linha não existe:** chama `vault_create_secret(access_token, 'meta_access_token')` via `adminClient.rpc()`; recebe o UUID do secret; faz `INSERT INTO meta_config` com `{ ad_account_id, ativo, vault_secret_id: <uuid_retornado> }`.
5. **Caso B — linha existe sem `vault_secret_id`:** chama `vault_create_secret(access_token, 'meta_access_token')`; recebe UUID; faz `UPDATE meta_config SET vault_secret_id = <uuid>, ad_account_id = ..., ativo = ... WHERE id = existing.id`.
6. **Caso C — linha existe com `vault_secret_id` preenchido:** chama `vault_update_secret(existing.vault_secret_id, access_token, 'meta_access_token')`; faz `UPDATE meta_config SET ad_account_id = ..., ativo = ... WHERE id = existing.id` (o `vault_secret_id` já está correto, não precisa atualizar).
7. Retorna `{ success: true }` com status 200.

### Edge Cases

- **`access_token` ausente no body:** a variável fica `undefined`; `vault_create_secret` receberá `null`, o que deve ser tratado retornando erro 400 antes de chamar o Vault.
- **`ad_account_id` ausente:** aceito como `null` — comportamento já existente no código atual.
- **`ativo` ausente:** assume `false` — comportamento já existente no código atual.
- **`vault_secret_id` na tabela aponta para um secret deletado manualmente no Vault:** `vault_update_secret` executará `UPDATE vault.secrets WHERE id = <uuid>` sem encontrar linhas; não lança erro, mas o token não é salvo. Tratar como erro genérico de Vault ou aceitar silenciosamente (decisão: retornar erro 500 com log).
- **Múltiplas linhas em `meta_config`:** o `.limit(1).single()` no select atual retorna erro se houver 0 linhas (`.single()` falha quando não há resultado). O `SELECT` deve usar `.maybeSingle()` em vez de `.single()` para retornar `null` quando não há registro sem lançar erro.

### Cenário de Erro

| Situação | Status | Body |
|---|---|---|
| JWT inválido ou ausente | 401 | `{ "error": "Unauthorized" }` |
| `access_token` não enviado no body | 400 | `{ "error": "access_token é obrigatório" }` |
| Falha na chamada RPC `vault_create_secret` | 500 | `{ "error": "Falha ao salvar token no Vault" }` |
| Falha na chamada RPC `vault_update_secret` | 500 | `{ "error": "Falha ao atualizar token no Vault" }` |
| Falha no `INSERT` ou `UPDATE` em `meta_config` | 500 | `{ "error": "Falha ao salvar configuração" }` |
| Exceção não capturada | 500 | `{ "error": "Erro interno" }` |

---

## Banco de Dados

- Tabela: `meta_config`
  - `id` — UUID PK, identifica o registro único de configuração
  - `ad_account_id` — TEXT, salvo diretamente (sem alteração)
  - `ativo` — BOOLEAN, salvo diretamente (sem alteração)
  - `vault_secret_id` — UUID, referência ao secret no Vault; preenchido após `vault_create_secret` ou já presente para `vault_update_secret`; nunca deve ser sobrescrito com `null`
  - `access_token` — TEXT, **nunca deve ser preenchido** por esta função

- Funções RPC disponíveis (definidas em `schema.sql`, chamadas via `adminClient.rpc()`):
  - `vault_create_secret(new_secret text, new_name text) → uuid` — cria secret no Vault e retorna seu UUID
  - `vault_update_secret(secret_id uuid, new_secret text, new_name text) → void` — atualiza secret existente pelo UUID

---

## Arquivos

- **Modificar:** `C:\Users\marce\OneDrive\Estudo\CRM_ae\supabase\functions\meta-save-config\index.ts` — extrair `access_token` do body; validar presença do `access_token`; trocar `.single()` por `.maybeSingle()` no select de existência; ampliar o select para incluir `vault_secret_id`; adicionar lógica de `vault_create_secret` / `vault_update_secret` via `adminClient.rpc()`; garantir que `access_token` nunca entre no `configPayload`

---

## Checklist

- [x] Extrair `access_token` do body junto com `ad_account_id` e `ativo`
- [x] Retornar erro 400 se `access_token` não estiver presente no body
- [x] Trocar `.single()` por `.maybeSingle()` no select de `meta_config` para não lançar erro quando não há registro
- [x] Ampliar o `SELECT` para incluir a coluna `vault_secret_id` além de `id`
- [x] Caso `vault_secret_id` seja `null` ou linha não exista: chamar `adminClient.rpc('vault_create_secret', { new_secret: access_token, new_name: 'meta_access_token' })` e capturar o UUID retornado
- [x] Caso `vault_secret_id` já exista: chamar `adminClient.rpc('vault_update_secret', { secret_id: existing.vault_secret_id, new_secret: access_token, new_name: 'meta_access_token' })`
- [x] Tratar erro retornado pelo RPC do Vault e retornar status 500 com mensagem adequada
- [x] Incluir `vault_secret_id` no payload de `INSERT` / `UPDATE` em `meta_config`
- [x] Confirmar que `access_token` não está em nenhum momento no `configPayload`
- [ ] Testar manualmente os três caminhos: sem linha, linha sem vault_secret_id, linha com vault_secret_id
