# 10: Backend — Função privilegiada para limpar leads e atividades de todos os usuários

**Tipo:** Implementação
**Página:** Execução no Servidor (Operação Privilegiada)

## Descrição
Criar a função de servidor com privilégio elevado (Edge Function ou RPC `SECURITY DEFINER`) que apaga todas as atividades e todos os leads de toda a base — de todos os usuários — contornando as regras de acesso por linha (RLS), com autenticação, autorização e resposta contendo a contagem de registros removidos.

## Escopo / Comportamentos
- **Receber a solicitação:** endpoint/função que recebe o pedido de limpeza disparado pela confirmação do usuário.
- **Exigir autenticação:** rejeitar a solicitação se o usuário não estiver autenticado.
- **Autorizar antes de executar:** validar que o solicitante tem permissão para a limpeza global; se não autorizado, recusar com erro sem apagar nada.
- **Excluir atividades vinculadas:** remover todas as atividades da base, inclusive as vinculadas a qualquer lead.
- **Excluir todos os leads:** remover todos os leads, de todos os usuários.
- **Garantir consistência:** ordem/transação de exclusão que não deixe atividades órfãs nem leads parcialmente removidos.
- **Responder o desfecho:** retornar sucesso (idealmente com a contagem de registros removidos: leads e atividades) ou erro, sem expor detalhes sensíveis.

## Notas de arquitetura
- Lógica de negócio e autorização exclusivamente no backend (thin client). O cliente nunca recebe a `service_role` key.
- A exclusão abrangente exige privilégio elevado porque o RLS impede o cliente de remover dados de outros usuários.
- Definir e documentar o critério de autorização (ex.: papel de administrador) usado.
- Tabelas envolvidas: `activities`, `leads` (ver `supabase/migrations/`).

## Dependência Lovable
Deploy de Edge Function e/ou migração de RPC exigem execução pela Lovable. Incluir, ao final da implementação, um prompt Lovable pronto para colar descrevendo a função, autorização, ordem de exclusão e formato da resposta com contagem.

---

## Abordagem Escolhida
**(a) Edge Function com `SUPABASE_SERVICE_ROLE_KEY`.**

Justificativa: o repositório já tem o padrão pronto e testado em `supabase/functions/manage-users/index.ts` (valida o usuário com `userClient` + faz a operação privilegiada com `adminClient` usando service role, que ignora RLS por natureza). Uma Edge Function retorna JSON com as contagens (`leads`, `activities`) de forma trivial, mantém a `service_role` 100% no servidor e é chamada pelo frontend via `supabase.functions.invoke` — já usado em `UsersPage.tsx`. Uma RPC `SECURITY DEFINER` também funcionaria, mas exigiria migração + `GRANT` + lógica de autorização em PL/pgSQL e devolve contagens de forma menos direta; a Edge Function reaproveita um padrão já estabelecido.

### Observação importante sobre autorização (RISCO)
As policies atuais de `leads` e `activities` (migration `20260309183018_*.sql`) são `FOR DELETE TO authenticated USING (true)` — ou seja, **qualquer usuário autenticado já consegue apagar todos os leads/atividades pelo cliente**, pois não há coluna `user_id` nem ownership por linha. O privilégio elevado aqui serve para **adicionar o gate de autorização (admin)** que hoje não existe, não para contornar um RLS restritivo.

Existe mecanismo de admin: tabela `public.user_roles` (`role IN ('admin','vendedor')`, `UNIQUE(user_id)`). A função **deve exigir `role = 'admin'`** do solicitante:
```sql
EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
```
Não há função helper `has_role`/`is_admin` no banco — a verificação é feita dentro da Edge Function consultando `user_roles` com o `adminClient`.

## Cenários
### Happy Path
1. Admin autenticado confirma a limpeza no frontend.
2. Frontend chama `supabase.functions.invoke("clear-crm")` (o JWT vai no header `Authorization` automaticamente).
3. Função valida JWT (`userClient.auth.getUser()`), confirma `role = 'admin'` em `user_roles`.
4. Com `adminClient` (service role): conta e apaga `activities`, depois conta e apaga `leads`.
5. Retorna `200 { success: true, deleted: { activities: N, leads: M } }`.

### Edge Cases
- Base já vazia: retorna `200` com `{ activities: 0, leads: 0 }` (idempotente, sem erro).
- Atividades órfãs não devem existir (FK), mas apagar `activities` primeiro garante consistência independentemente do cascade.
- `OPTIONS` (preflight CORS) retorna `204/200` com `corsHeaders`.
- Usuário autenticado porém **sem** linha em `user_roles` ou com `role = 'vendedor'`: `403`, nada é apagado.

### Cenário de Erro
- Sem header `Authorization` / JWT inválido: `401 { error: "Unauthorized" }`, nada apagado.
- Não-admin: `403 { error: "Forbidden" }` (mensagem genérica, sem detalhes sensíveis), nada apagado.
- Falha no delete (ex.: erro do Postgres): `500 { error: "..." }`; como `activities` é apagado antes de `leads`, não restam atividades órfãs. (Edge Functions não abrem transação multi-statement via supabase-js; a ordem activities→leads + FK `ON DELETE CASCADE` garante que não fiquem leads com atividades órfãs.)

## Banco de Dados
- **`public.activities`** — apagada por completo (FK `lead_id → leads(id) ON DELETE CASCADE`, definida em `20260309183018_*.sql`). Apagada **primeiro** para obter contagem e garantir consistência.
- **`public.leads`** — apagada por completo em seguida.
- **`public.user_roles`** — apenas **lida** (verificação de admin). Não é alterada.
- Nenhuma migração nova de schema é necessária. Os deletes via service role usam um filtro universal (ex.: `.delete().not("id", "is", null)`), pois supabase-js exige um filtro no `delete()`.

## Arquivos
- **Criar:** `supabase/functions/clear-crm/index.ts` — Edge Function: CORS (mesmo `corsHeaders` de `manage-users`), trata `OPTIONS`, valida JWT com `userClient`, confirma `role='admin'` em `user_roles` via `adminClient`, conta+apaga `activities` e depois `leads` com `adminClient` (service role), retorna `{ success, deleted: { activities, leads } }`. Baseado em `supabase/functions/manage-users/index.ts`.
- **Modificar:** `supabase/config.toml` — adicionar bloco `[functions.clear-crm]` com `verify_jwt = false` (a função valida o JWT manualmente, igual às demais).

> Frontend (botão/confirmação que chama `invoke("clear-crm")`) é escopo de outra issue (frontend) — não criar aqui.

## Deploy (Lovable / Supabase CLI)
A Edge Function e a alteração em `config.toml` **não têm efeito até serem deployadas**. Editar os arquivos localmente não publica nada na instância Supabase. É necessário deploy da função `clear-crm` via Lovable (ou `supabase functions deploy clear-crm` pela CLI). Não há migração de schema a aplicar. Garantir que o usuário de teste tenha `role = 'admin'` em `user_roles`.

## Checklist
- [x] Criar `supabase/functions/clear-crm/index.ts` seguindo o padrão de `manage-users` (imports `@supabase/supabase-js@2.49.1`, `corsHeaders`, tratamento de `OPTIONS`)
- [x] Validar autenticação via `userClient.auth.getUser()` → `401` se inválido
- [x] Obter `auth.uid()` e exigir `role = 'admin'` consultando `user_roles` com `adminClient` → `403` se não-admin (mensagem genérica)
- [x] Apagar `activities` primeiro (com contagem) e depois `leads` (com contagem), usando `adminClient` (service role)
- [x] Retornar `{ success: true, deleted: { activities, leads } }` em caso de sucesso
- [x] Não expor `service_role` nem detalhes sensíveis de erro na resposta
- [x] Adicionar `[functions.clear-crm]` com `verify_jwt = false` em `supabase/config.toml`
- [x] Documentar no resultado o **risco** de que as policies atuais já permitem qualquer autenticado apagar a base, e que esta função adiciona o gate de admin
- [x] Fornecer o prompt Lovable para deploy da função
