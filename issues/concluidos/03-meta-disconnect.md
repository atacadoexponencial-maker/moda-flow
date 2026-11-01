# 03: meta-disconnect — Remover token do Vault

**Tipo:** Implementação
**Módulo:** meta-disconnect

## Descrição

Atualizar a Edge Function `meta-disconnect` para excluir o secret do Vault ao desconectar a integração e limpar o `vault_secret_id` de `meta_config`.

## Comportamentos

- Buscar vault_secret_id do registro: ao carregar a linha de `meta_config`, incluir `vault_secret_id` na seleção além do `id`.
- Excluir secret do Vault: se `vault_secret_id` não for nulo, chamar `vault_delete_secret` para apagar o secret criptografado do Vault.
- Limpar vault_secret_id na tabela: atualizar a coluna `vault_secret_id` para `null` na linha de `meta_config`.
- Limpar demais campos de conexão: manter o comportamento atual de apagar `token_expires_at`, `meta_user_name` e `oauth_state`.
- Não tentar deletar do Vault se vault_secret_id for nulo: se o campo já estiver vazio, pular a chamada a `vault_delete_secret` sem gerar erro.
- Retornar sucesso mesmo sem registro: se não existir linha em `meta_config`, retornar `{ success: true }` sem falhar.

## Cenários

1. **Registro existe com vault_secret_id preenchido:** seleciona `id` e `vault_secret_id`, chama `vault_delete_secret(vault_secret_id)`, depois atualiza a linha zerando `vault_secret_id`, `access_token`, `token_expires_at`, `meta_user_name` e `oauth_state`. Retorna `{ success: true }`.
2. **Registro existe com vault_secret_id nulo:** seleciona `id` e `vault_secret_id`, pula a chamada ao Vault, atualiza a linha zerando os demais campos. Retorna `{ success: true }`.
3. **Registro não existe em meta_config:** `config` é nulo, retorna imediatamente `{ success: true }` sem nenhuma operação no banco.
4. **Usuário não autenticado:** retorna 401 antes de qualquer operação.

## Banco de Dados

- **Tabela lida:** `meta_config` — colunas `id`, `vault_secret_id`
- **Função RPC chamada:** `public.vault_delete_secret(secret_id uuid)` — deleta o registro em `vault.secrets` pelo id
- **Tabela atualizada:** `meta_config` — colunas zeradas: `vault_secret_id`, `access_token`, `token_expires_at`, `meta_user_name`, `oauth_state`

## Arquivos

- **Modificar:** `supabase/functions/meta-disconnect/index.ts`
  - Alterar `.select("id")` para `.select("id, vault_secret_id")`
  - Após obter `config`, se `config.vault_secret_id` não for nulo, chamar `adminClient.rpc("vault_delete_secret", { secret_id: config.vault_secret_id })`
  - Adicionar `vault_secret_id: null` ao objeto de update
  - Remover `access_token: null` do update (campo legado, não descrito como obrigatório na issue — manter por segurança conforme comportamento atual)

## Checklist

- [x] Alterar select para incluir `vault_secret_id`
- [x] Adicionar chamada condicional a `vault_delete_secret` via `adminClient.rpc`
- [x] Adicionar `vault_secret_id: null` no objeto de update
- [x] Verificar que `access_token: null` permanece no update (limpeza de campo legado)
- [x] Confirmar que o fluxo "sem registro" continua retornando `{ success: true }` sem erro
