# Pendências para Colocar o CRM no Ar

> Diagnóstico completo do estado do projeto e o que falta para o lançamento real.
> Data da análise: 2026-06-15
> Stack: React + Vite + TypeScript + shadcn/ui · Supabase (Postgres + Edge Functions) · deploy Vercel

## Progresso (2026-06-15)

- ✅ **#1** Fluxo de deploy validado (Supabase CLI linkada, histórico de migrations limpo).
- ✅ **#2/#3** `master` e `main` alinhadas; migration `grant_meta_config_safe` commitada; migrations do Vault aplicadas; functions `meta-oauth-callback`/`meta-save-config` deployadas.
- ✅ **Feature de Atribuição** (`fbc`, `gclid`, `external_id`, `utm_term`) implementada, deployada e verificada end-to-end em produção. `external_id` indexado e documentado como chave canônica futura da dedup.
- ✅ **#6b** `webhook-lead` agora com `verify_jwt = false` (config.toml + redeploy). Verificado: POST só com `x-webhook-token` cria lead; sem token, rejeita com mensagem própria. Webhook externo funciona com um header só.
- ⏳ Restam: **#4** (admin no manage-users), **#7** (deduplicação), **#5/#8** (contagem de leads), engenharia (#9+).

---

## Estado atual (resumo)

O sistema **builda e está funcional**, hospedado na Vercel + Supabase, recém-desconectado do
Lovable. Há um problema operacional central (fluxo de deploy indefinido) que precisa ser resolvido
antes de tudo, além de brechas de segurança reais. Build passa; testes e CI praticamente
inexistentes.

---

## 🔴 Bloqueadores (resolver antes de considerar "no ar")

### 1. Deploy do backend é separado do Vercel — via Supabase CLI (fluxo validado em 2026-06-15)
- **Vercel faz deploy só do frontend** (app Vite estático) a cada push. Ele **não** aplica migrations
  nem deploya edge functions — isso era feito pelo Lovable, hoje removido.
- **Backend = Supabase CLI** (já instalada, logada e linkada ao projeto de produção
  `ynjxvzjomizfyabupvne` / "crm-sete-aceleradora"). Estado verificado:
  - `supabase migration list`: histórico **limpo**, só 2 migrations pendentes no remoto
    (`20260428000000` grant_meta_config_safe e `20260428000001` vault_upsert_secret).
  - `supabase db push` aplica as pendentes sem conflito.
  - `supabase functions deploy <nome>` deploya as funções (e o `verify_jwt` do `config.toml` passa
    a valer).
  - `src/integrations/supabase/types.ts` se regenera com `supabase gen types typescript --linked`.
- **O que ainda NÃO foi ao ar** (está só nos commits locais à frente / migrations pendentes):
  - migrations do Vault (as 2 pendentes acima)
  - edge functions editadas recentemente: `meta-oauth-callback`, `meta-save-config`
- **Ação:** rodar `supabase db push` + `supabase functions deploy meta-oauth-callback meta-save-config`;
  atualizar o `CLAUDE.md` (que ainda manda usar Lovable). Vercel CLI opcional (`npm i -g vercel`).

### 2. Branch desalinhada — fixes podem não estar em produção
- Branch atual `master` está **3 commits à frente** da `main` (default do remote, provável fonte de
  deploy da Vercel):
  - `b450814` fix: vault_upsert_secret use built-in vault functions
  - `7a5e04c` fix: use vault_upsert_secret in OAuth callback
  - `84227c8` fix: make access_token optional in meta-save-config
- Se Vercel/Supabase puxam de `main`, esses fixes de Vault/OAuth **não estão no ar**.
- **Ação:** merge `master → main` (ou alinhar a branch de deploy).

### 3. Migration não commitada nem aplicada
- `supabase/migrations/20260428000000_grant_meta_config_safe.sql` está **untracked** (só em disco).
- Conteúdo: `GRANT SELECT ON public.meta_config_safe TO authenticated;`
- Sem ele, o frontend não consegue ler se a integração Meta está configurada.
- **Ação:** commitar e aplicar a migration.

---

## 🛡️ Segurança (corrigir antes de uso real)

### 4. `manage-users` não valida admin — escalação de privilégio
- `supabase/functions/manage-users/index.ts` só checa se existe usuário logado (`getUser()`), **não
  verifica se é admin** antes de `listUsers`, `inviteUserByEmail`, `deleteUser`.
- **Qualquer usuário autenticado pode convidar ou deletar usuários.**
- **Ação:** adicionar check de `user_roles.role = 'admin'` (ou função `has_role`) antes das ações.

### 5. RLS totalmente permissivo nas tabelas principais
- Policies de `leads` e `activities` são `USING (true)` para qualquer `authenticated` — todos leem,
  editam e apagam tudo.
- Aceitável se a equipe é pequena e confiável, mas é uma decisão que deve ser **consciente e
  documentada**, não acidental.

### 6. `verify_jwt = false` em todas as edge functions + CORS `*`
- `meta-*` e `manage-users` dependem de validação manual interna; `webhook-lead` valida por token (ok).
- **Ação:** auditar cada função para garantir que nenhuma fica aberta sem validação.

### 6b. ⚠️ `webhook-lead` está com `verify_jwt = true` em produção — webhook externo NÃO funciona só com o token
- Confirmado por teste em produção (2026-06-15): POST sem `Authorization` retorna
  `UNAUTHORIZED_NO_AUTH_HEADER` do **gateway** do Supabase; só atravessa quando se envia também
  `Authorization: Bearer <ANON_KEY>`. A `webhook-lead` **não está declarada** no `config.toml`,
  então herda o padrão `verify_jwt = true`.
- **Sintoma:** quem integra (formulário, Typebot, n8n) precisaria mandar DOIS headers
  (`Authorization: Bearer <anon>` **e** `x-webhook-token`), o que contradiz o design da tela de
  Webhook (o exemplo cURL lá só usa `x-webhook-token`).
- **Ação:** adicionar ao `supabase/config.toml`:
  ```toml
  [functions.webhook-lead]
  verify_jwt = false
  ```
  e redeployar a função (depende do fluxo de deploy — item #1). Após isso, basta o `x-webhook-token`.
- O mesmo vale auditar para `import-csv` (também ausente do `config.toml`).

---

## 📊 Qualidade de dados (problema de negócio já investigado)

### 7. Deduplicação NÃO implementada
- Spec pronta em `atualizacoes-ajustes/deduplicacao-leads.md`, mas `webhook-lead/index.ts` ainda faz
  **só `insert`** — cada reenvio de formulário/reimportação cria lead **duplicado**. `import-csv` idem.
- ⚠️ Armadilha: a spec manda gravar `description` em `activities`, mas a tabela tem a coluna `content`
  (ver migration `20260309183018_*`). Copiar literal vai falhar.
- **Ação:** implementar dedup por email/whatsapp (upsert + nota de retorno) em ambas as funções.

### 8. Divergência de contagem ClickUp (280) vs CRM (266)
- ~14 leads somem na contagem mensal. Investigação em
  `atualizacoes-ajustes/investigacao-divergencia-leads-clickup-supabase.md`.
- Causa provável: leads importados sem `data_criada` recebem `created_at` = data da importação,
  caindo fora do filtro de mês (`import-csv/index.ts` linhas ~200-204).
- **Ação:** confirmar contagem no Supabase com a query do doc e auditar a importação.

---

## 🔧 Engenharia (não bloqueia o lançamento, mas importa)

| Item | Estado | Ação sugerida |
|---|---|---|
| **Testes** | Só `src/test/example.test.ts` (trivial). Playwright configurado, sem E2E. | Cobertura mínima das funções críticas (dedup, normalização de status). |
| **CI/CD** | Sem `.github/` — nada roda lint/build/test no push. | Workflow GitHub Actions: lint + build + test. |
| **Lint** | 64 erros (maioria `@typescript-eslint/no-explicit-any`); build passa. | Limpeza gradual; `npm run lint -- --fix` resolve parte. |
| **Bundle** | 1.26 MB num único chunk, sem code-splitting. | `manualChunks` / `import()` dinâmico nas rotas. |
| **CSS** | Warning de `@import` fora de ordem no build de `index.css`. | Mover `@import` de fontes para o topo do arquivo. |

---

## 🎯 Ordem recomendada de execução

1. **Definir o fluxo de deploy** (Supabase CLI + branch da Vercel) — *desbloqueia todo o resto* (#1)
2. **Merge `master → main`** + commit da migration `grant_meta_config_safe` (#2, #3)
3. **Fix de segurança no `manage-users`** (checar admin) (#4)
4. **Implementar deduplicação** webhook + CSV (#7)
5. **Investigar a divergência de contagem** dos leads (#8)
6. **Pós-lançamento:** CI, testes, code-splitting, limpeza de lint (#9 em diante)

---

## Referências no repositório

- `atualizacoes-ajustes/deduplicacao-leads.md` — spec da deduplicação
- `atualizacoes-ajustes/investigacao-divergencia-leads-clickup-supabase.md` — investigação da contagem
- `spec.md` — migração do access_token Meta para o Vault (já implementada)
- `supabase/functions/manage-users/index.ts` — função com gap de autorização
- `supabase/functions/webhook-lead/index.ts` — ponto de entrada de leads, sem dedup
- `supabase/migrations/` — schema e RLS
