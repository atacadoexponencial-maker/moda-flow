# 02: meta-fetch-insights — Ler token do Vault

**Tipo:** Implementação
**Módulo:** meta-fetch-insights

## Descrição

Atualizar a Edge Function `meta-fetch-insights` para ler o access_token do Vault usando o `vault_secret_id` armazenado em `meta_config`, removendo qualquer referência à coluna `access_token`.

## Comportamentos

- Buscar configuração com vault_secret_id: ao carregar a configuração de `meta_config`, selecionar os campos `id`, `vault_secret_id`, `ad_account_id`, `ativo` e `token_expires_at` (remover `access_token` da seleção).
- Verificar presença de vault_secret_id: se `vault_secret_id` for nulo ou ausente, retornar erro informando que a integração não está configurada e o usuário deve reconectar.
- Ler token do Vault: usar `vault_read_secret` passando o `vault_secret_id` para obter o valor decifrado do access_token.
- Verificar se o token lido não está vazio: se `vault_read_secret` retornar nulo ou string vazia, retornar erro informando que a integração não está configurada.
- Renovar token próximo do vencimento: se `token_expires_at` indicar que o token vence em até 10 dias, tentar renovar via API do Meta.
- Atualizar token renovado no Vault: se a renovação for bem-sucedida, atualizar o secret existente no Vault usando `vault_update_secret` com o novo token (não gravar na coluna `access_token`).
- Atualizar token_expires_at na tabela: após renovação bem-sucedida, atualizar apenas a coluna `token_expires_at` em `meta_config`.
- Prosseguir com a busca de insights: usar o token obtido (original ou renovado) para chamar a API do Meta Ads e sincronizar os dados normalmente.

---

## Cenários

### Happy Path

1. Request chega com header `Authorization: Bearer <jwt>` válido.
2. `adminClient` busca `meta_config` e retorna linha com `vault_secret_id` preenchido, `ativo = true`, `ad_account_id` preenchido e `token_expires_at` com mais de 10 dias.
3. RPC `vault_read_secret(vault_secret_id)` retorna string não vazia com o access_token decifrado.
4. Token não está próximo do vencimento — bloco de renovação é pulado.
5. API do Meta retorna insights com paginação; todos os registros são inseridos em `meta_ads_cache`.
6. Resposta: `{ success: true, campaigns_synced: N }` com status 200.

### Edge Cases

- **Token próximo do vencimento (≤ 10 dias):** `vault_read_secret` retorna o token, a renovação é tentada, a API do Meta devolve `access_token` + `expires_in`. O novo token é salvo via `vault_update_secret(vault_secret_id, novoToken, nomeAtual)` e `token_expires_at` é atualizado em `meta_config`. O nome passado para `vault_update_secret` deve ser o mesmo nome já registrado no vault — como a função atual não lê o nome, deve-se usar um nome fixo determinístico (ex: `"meta_access_token"`).
- **Renovação falha (API do Meta retorna erro):** o erro é logado com `console.error`, mas a execução continua usando o token original lido do Vault — igual ao comportamento atual.
- **`META_APP_ID` ou `META_APP_SECRET` ausentes:** renovação é ignorada com `console.warn`, execução continua com token original.
- **Paginação da API do Meta:** o loop `while (nextUrl)` continua funcionando sem alteração.
- **`token_expires_at` nulo:** o bloco de renovação é pulado inteiramente — igual ao comportamento atual.

### Cenário de Erro

| Condição | Status | Mensagem retornada |
|---|---|---|
| Header `Authorization` ausente ou sem prefixo `Bearer` | 401 | `"Unauthorized"` |
| JWT inválido (`userClient.auth.getUser()` retorna erro) | 401 | `"Unauthorized"` |
| `config` não encontrado ou `ad_account_id` nulo | 400 | `"Configuração incompleta. Configure o Ad Account ID."` |
| `config.ativo === false` | 400 | `"Integração desativada"` |
| `config.vault_secret_id` nulo ou ausente | 400 | `"Integração Meta não configurada. Reconecte em Configurações."` |
| `vault_read_secret` retorna `null` ou `""` | 400 | `"Integração Meta não configurada. Reconecte em Configurações."` |
| API do Meta retorna `json.error` durante busca de insights | 502 | `json.error.message` ou `"Erro na API do Meta"` |
| Exceção não tratada (catch externo) | 500 | `"Erro interno"` |

---

## Banco de Dados

### Colunas relevantes de `meta_config`

| Coluna | Tipo | Uso nesta função |
|---|---|---|
| `id` | UUID | Chave para `update` de `token_expires_at` |
| `vault_secret_id` | UUID | Passado para `vault_read_secret` e `vault_update_secret` |
| `ad_account_id` | TEXT | Usado na URL da API do Meta |
| `ativo` | BOOLEAN | Guarda contra integração desativada |
| `token_expires_at` | TIMESTAMPTZ | Determina se o token precisa ser renovado |
| `access_token` | TEXT | **NÃO deve mais ser selecionado nem atualizado** |

### Funções RPC usadas

- `vault_read_secret(secret_id uuid) → text` — lê o secret decifrado a partir de `vault.decrypted_secrets`. Chamada via `adminClient.rpc('vault_read_secret', { secret_id: config.vault_secret_id })`.
- `vault_update_secret(secret_id uuid, new_secret text, new_name text) → void` — sobrescreve o secret no Vault. Chamada via `adminClient.rpc('vault_update_secret', { secret_id: config.vault_secret_id, new_secret: accessToken, new_name: 'meta_access_token' })`.

---

## Arquivos

- **Modificar:** `supabase/functions/meta-fetch-insights/index.ts`
  - Linha 43: remover `access_token` do `.select(...)`, adicionar `vault_secret_id`.
  - Linhas 61–68: substituir a verificação de `config.access_token` por verificação de `config.vault_secret_id` seguida de chamada RPC `vault_read_secret`.
  - Linhas 99–105 (bloco de renovação): substituir o `update({ access_token, token_expires_at })` por duas operações: RPC `vault_update_secret` + `update({ token_expires_at })`.
  - Nenhuma outra parte do arquivo deve ser alterada.

---

## Checklist

- [x] `.select()` em `meta_config` contém `id, vault_secret_id, ad_account_id, ativo, token_expires_at` — sem `access_token`
- [x] Verificação de `vault_secret_id` nulo retorna status 400 com mensagem de reconexão
- [x] `adminClient.rpc('vault_read_secret', { secret_id: config.vault_secret_id })` é chamado após verificar `vault_secret_id`
- [x] Verificação de token vazio após `vault_read_secret` retorna status 400 com mensagem de reconexão
- [x] Variável `accessToken` recebe o valor retornado por `vault_read_secret`, não `config.access_token`
- [x] Bloco de renovação chama `adminClient.rpc('vault_update_secret', { secret_id, new_secret, new_name })` em vez de `update({ access_token })`
- [x] Após renovação, apenas `token_expires_at` é atualizado em `meta_config` (sem `access_token`)
- [x] Nenhuma referência a `config.access_token` permanece no arquivo
- [x] O restante da função (fetch de insights, paginação, insert em `meta_ads_cache`, resposta final) permanece sem alterações
