# 04: Schema — Remover coluna access_token após migração

**Tipo:** Implementação
**Módulo:** Schema / Banco de Dados

## Descrição

Atualizar a view `meta_config_safe` e criar migration para remover a coluna `access_token` da tabela `meta_config`, eliminando o armazenamento do token em texto puro após a migração para o Vault.

## Comportamentos

- Atualizar a view meta_config_safe: substituir a verificação `(access_token IS NOT NULL AND access_token != '') AS token_configurado` por `(vault_secret_id IS NOT NULL) AS token_configurado`, de forma que o indicador de token configurado passe a se basear na presença do `vault_secret_id`.
- Remover a coluna access_token da tabela: após garantir que nenhuma Edge Function a utiliza mais, executar migration para dropar a coluna `access_token` de `meta_config`.

## Cenários

- **Cenário 1 — Token configurado via Vault:** `vault_secret_id` preenchido → `token_configurado = true` na view.
- **Cenário 2 — Token não configurado:** `vault_secret_id` nulo → `token_configurado = false` na view.
- **Cenário 3 — Coluna removida com segurança:** `access_token` dropada com `IF EXISTS`, sem falha se já não existir.
- **Cenário 4 — View recriada corretamente:** DROP VIEW antes do DROP COLUMN garante que a dependência é removida antes da alteração da tabela.

## Arquivos

- `supabase/migrations/20260424000000_remove_access_token_use_vault.sql` — nova migration (criado)
- `supabase/schema.sql` — estado final do schema (atualizado)

## Checklist

- [x] Criar migration `20260424000000_remove_access_token_use_vault.sql`
- [x] DROP VIEW IF EXISTS public.meta_config_safe
- [x] ALTER TABLE public.meta_config DROP COLUMN IF EXISTS access_token
- [x] Recriar view meta_config_safe usando (vault_secret_id IS NOT NULL) AS token_configurado
- [x] Atualizar schema.sql: remover coluna access_token da definição da tabela meta_config
- [x] Atualizar schema.sql: refletir nova view meta_config_safe
