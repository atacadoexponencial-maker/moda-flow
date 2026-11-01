# 05: Módulo de desconexão (`whatsapp-disconnect`)

**Tipo:** Implementação
**Página/Módulo:** Módulo de Desconexão (`whatsapp-disconnect`)

## Descrição

Criar a Edge Function autenticada que remove a conexão do WhatsApp, apagando o token do Vault e limpando os dados de conexão da configuração de forma idempotente.

## Checklist de comportamentos

- [x] Exigir autenticação: rejeitar requisição sem usuário autenticado.
- [x] Tratar ausência de conexão: responder com sucesso mesmo se não houver nada a remover (idempotente).
- [x] Remover token do Vault quando houver `vault_secret_id`.
- [x] Limpar dados de conexão: zerar `vault_secret_id`, `waba_id`, `phone_number_id`, `display_phone_number`, `verified_name`, `oauth_state` e marcar `ativo = false`.
- [x] Confirmar desconexão: retornar sucesso após a limpeza.

## Cenários

### Happy path (conexão existente)
1. Requisição `POST` com header `Authorization: Bearer <token>` válido.
2. `getUser()` confirma o usuário.
3. Service role lê `whatsapp_config` e encontra linha com `vault_secret_id`.
4. RPC `vault_delete_secret` apaga o segredo do Vault.
5. `UPDATE` zera `vault_secret_id`, `waba_id`, `phone_number_id`, `display_phone_number`, `verified_name`, `oauth_state` e seta `ativo = false`.
6. Responde `{ success: true }` (200).

### Sem conexão / idempotente
- Não há linha em `whatsapp_config` → responde `{ success: true }` direto (sem tocar no Vault).
- Há linha mas `vault_secret_id` é `null` → pula a chamada ao Vault, mas ainda assim limpa/normaliza a config e responde `{ success: true }`.
- Chamar duas vezes seguidas produz o mesmo resultado final (`ativo = false`, campos nulos).

### Erro
- Sem header `Authorization: Bearer` → `401 { error: "Unauthorized" }`.
- `getUser()` retorna erro (token inválido/expirado) → `401 { error: "Unauthorized" }`.
- Exceção inesperada → `500 { error: "Erro interno" }`.

## Arquivos

- `supabase/functions/whatsapp-disconnect/index.ts` (criar) — espelha `supabase/functions/meta-disconnect/index.ts`.

## Espelhamento do Vault (meta-disconnect)

`meta-disconnect` chama a RPC `public.vault_delete_secret(secret_id uuid)` (definida na migration `20260310092955_*.sql`) somente quando `config.vault_secret_id` existe, e em seguida zera a referência na config. A RPC existe e é reutilizada aqui — não é necessário criar helper novo.

## Notas

- Espelhar `supabase/functions/meta-disconnect`.
- Tabela base `whatsapp_config` definida em `supabase/migrations/20260620000000_whatsapp_config.sql`.
- Deploy via Lovable (incluir prompt Lovable).
