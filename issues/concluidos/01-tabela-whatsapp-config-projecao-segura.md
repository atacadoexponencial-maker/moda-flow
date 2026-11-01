# 01: Tabela whatsapp_config + projeção segura + RLS

**Tipo:** Implementação
**Página/Módulo:** Armazenamento da Configuração do WhatsApp (`whatsapp_config`)

## Descrição

Criar a migration que adiciona a tabela `whatsapp_config` (linha única, espelhando `meta_config`), a view segura `whatsapp_config_safe` e as políticas de RLS que impedem o frontend de acessar o token ou a referência ao Vault.

## Checklist de comportamentos

- [x] Criar tabela `whatsapp_config` com colunas: `id`, `vault_secret_id`, `waba_id`, `phone_number_id`, `display_phone_number`, `verified_name`, `ativo`, `oauth_state`, `created_at`, `updated_at`.
- [x] Garantir linha única por instância (restrição/índice ou padrão equivalente ao usado em `meta_config`). — `meta_config` não tem constraint de linha única no banco; unicidade fica na aplicação. Espelhado fielmente (sem constraint DB). Ver seção "Observação sobre linha única".
- [x] Habilitar RLS na tabela; nenhuma policy de SELECT direto para `authenticated` sobre a tabela base (apenas backend/service role).
- [x] Criar view `whatsapp_config_safe` expondo apenas dados de status: `id`, `waba_id`, `phone_number_id`, `display_phone_number`, `verified_name`, `ativo`, `created_at` e `(vault_secret_id IS NOT NULL) AS token_configurado` — sem expor `vault_secret_id` nem `oauth_state`.
- [x] `GRANT SELECT ON public.whatsapp_config_safe TO authenticated`.
- [x] Trigger/coluna para manter `updated_at` em cada alteração (função `public.set_updated_at()` + trigger `trg_whatsapp_config_updated_at`).

## Cenários

### Happy path
- O backend (service role) insere a única linha de `whatsapp_config` com `vault_secret_id` apontando para o segredo no Vault e os metadados do WhatsApp (`waba_id`, `phone_number_id`, etc.) e `ativo = true`.
- O frontend (role `authenticated`) consulta `public.whatsapp_config_safe` e recebe apenas dados de status, incluindo `token_configurado = true`, sem nunca ver `vault_secret_id` nem `oauth_state`.
- Um `UPDATE` na tabela base feito pelo backend atualiza automaticamente `updated_at` via trigger.

### Edge cases
- Tabela sem nenhuma linha: a view `whatsapp_config_safe` simplesmente retorna 0 linhas (frontend trata como "não configurado").
- `vault_secret_id` nulo (config criada mas token ainda não salvo): `token_configurado` resolve para `false`.
- `oauth_state` preenchido durante o handshake OAuth: nunca aparece na view, permanece restrito ao backend.

### Erro
- Tentativa do frontend (`authenticated`) de `SELECT` direto na tabela base `public.whatsapp_config`: bloqueada por RLS (nenhuma policy de SELECT para `authenticated`), retorna 0 linhas / acesso negado.
- Acesso ao token em texto puro é impossível: a tabela só guarda a referência `vault_secret_id`, nunca o token.

## Banco de Dados

### Tabela `public.whatsapp_config` (colunas exatas)

| Coluna                | Tipo          | Constraint / Default                  |
|-----------------------|---------------|---------------------------------------|
| `id`                  | `uuid`        | PRIMARY KEY, DEFAULT `gen_random_uuid()` |
| `vault_secret_id`     | `uuid`        | NULL                                  |
| `waba_id`             | `text`        | NULL                                  |
| `phone_number_id`     | `text`        | NULL                                  |
| `display_phone_number`| `text`        | NULL                                  |
| `verified_name`       | `text`        | NULL                                  |
| `ativo`               | `boolean`     | NOT NULL DEFAULT `false`              |
| `oauth_state`         | `text`        | NULL                                  |
| `created_at`          | `timestamptz` | NOT NULL DEFAULT `now()`              |
| `updated_at`          | `timestamptz` | NOT NULL DEFAULT `now()`              |

### View `public.whatsapp_config_safe`
Expõe somente: `id`, `waba_id`, `phone_number_id`, `display_phone_number`, `verified_name`, `ativo`, `created_at`, `(vault_secret_id IS NOT NULL) AS token_configurado`. **Não** expõe `vault_secret_id` nem `oauth_state`.

### RLS / GRANTs
- `ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;`
- Nenhuma policy de SELECT para `authenticated` na tabela base (apenas service role do backend acessa). Espelhando a intenção de segurança da migration de Vault; o acesso de leitura do frontend é exclusivamente via view.
- `GRANT SELECT ON public.whatsapp_config_safe TO authenticated;`

### Trigger de `updated_at`
- Não existe função de trigger de `updated_at` no schema atual (verificado por grep — `meta_config` não tem `updated_at` nem trigger). Portanto a migration cria a função reutilizável `public.set_updated_at()` (`BEFORE UPDATE`) e o trigger `trg_whatsapp_config_updated_at`.

### Observação sobre "linha única"
`meta_config` **não** possui constraint de linha única no banco (verificado — sem unique index parcial); a unicidade é tratada na aplicação. Para espelhar EXATAMENTE o padrão de `meta_config`, esta migration **não** adiciona constraint de linha única no banco. A unicidade fica a cargo do backend, como em `meta_config`.

## Arquivos

- Criar: `supabase/migrations/20260620000000_whatsapp_config.sql` (data de hoje, formato `YYYYMMDDHHMMSS_descricao.sql`, posterior à última migration `20260615000000`).

## Notas

- Espelhar `supabase/migrations/20260424000000_remove_access_token_use_vault.sql` e `20260428000000_grant_meta_config_safe.sql` (padrão de view segura + GRANT) e `20260310083344_*.sql` (criação de `meta_config` + RLS + view).
- Migration aplicada via Lovable (incluir prompt Lovable).

---
**Lovable input:**
```
Crie uma migration que adicione a tabela public.whatsapp_config espelhando o modelo de meta_config:
colunas id (uuid pk default gen_random_uuid), vault_secret_id (uuid null), waba_id (text), phone_number_id (text), display_phone_number (text), verified_name (text), ativo (boolean default false), oauth_state (text null), created_at (timestamptz default now()), updated_at (timestamptz default now()).
Garanta no máximo uma linha (índice único parcial igual ao padrão de meta_config). Habilite RLS sem policy de SELECT direto para authenticated na tabela base.
Crie a view public.whatsapp_config_safe expondo apenas: id, waba_id, phone_number_id, display_phone_number, verified_name, ativo, created_at e (vault_secret_id IS NOT NULL) AS token_configurado. Execute GRANT SELECT ON public.whatsapp_config_safe TO authenticated.
Adicione trigger para atualizar updated_at em cada UPDATE.
Depois regenere src/integrations/supabase/types.ts.
```
---
