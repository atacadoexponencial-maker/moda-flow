# S1-01: Papéis proprietário e admin

**Tipo:** Implementação
**Página:** Configurações › Usuários
**Spec:** `spec-operacao-comercial.md`

## Descrição

Reduzir os papéis a "proprietario" (conta atual, única e intocável) e "admin"; tirar "vendedor" e o "proprietário" com acento da tela; fazer convite entrar como admin; e fazer as operações privilegiadas (gestão de usuários, limpar CRM) aceitarem os dois papéis.

## Pronto quando

Na tela de Usuários, a conta atual aparece como Proprietário sem ações de remover/rebaixar; um convite novo entra como Admin sem intervenção; o seletor de papel só oferece Admin; usuário sem papel é recusado nas operações privilegiadas.

## Critérios de aceite

- **CA-S1-01** (automática) — Só existem os papéis proprietário e admin. Dado o cadastro de papéis do sistema, quando alguém tenta registrar um papel diferente de "proprietario" ou "admin" (inclusive "vendedor" ou "proprietário" com acento), então o registro é recusado.
- **CA-S1-02** (automática) — A conta atual vira a proprietária. Dado a base em produção com um único usuário com papel admin, quando a mudança entra no ar, então esse usuário passa a ter o papel "proprietario" e é o único com esse papel.
- **CA-S1-03** (automática) — Proprietário não pode ser removido nem rebaixado. Dado um admin logado na tela de Usuários, quando tenta remover o proprietário ou trocar o papel dele, então a ação não aparece disponível e, se forçada, o servidor recusa.
- **CA-S1-04** (automática) — Convidado entra como admin. Dado um proprietário ou admin na tela de Usuários, quando convida um e-mail novo, então o convite é enviado e, ao aceitar, o usuário já aparece na lista como "Admin" sem ninguém precisar definir o papel.
- **CA-S1-05** (automática) — Gestão de usuários aceita proprietário e admin. Dado um usuário logado com papel proprietário ou admin, quando lista, convida ou remove usuários, ou limpa o CRM, então a operação é aceita; um usuário sem papel recebe recusa.
- **CA-S1-06** (manual) — Tela de Usuários mostra só os dois papéis. Dado a tela de Usuários aberta, quando o proprietário abre o seletor de papel de um admin, então só aparece "Admin" (o papel "Proprietário" não é atribuível pela tela) e não existe "Vendedor".

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-01 | O único usuário com login hoje (o admin existente) é a conta que vira proprietária. | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-07 | Provas que dependem do banco rodam como testes de integração contra o projeto Supabase de produção, criando usuários temporários `@teste.com` e apagando tudo ao final; só executam quando o `.env` local tem a service role (no CI ficam pulados). | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.

## Cenários

### Happy Path
1. A migration entra: o CHECK de `user_roles.role` passa a aceitar só `proprietario` e `admin`; a única linha `admin` existente (conta atual) vira `proprietario`; um índice garante no máximo um proprietário; um trigger impede alterar ou apagar a linha do proprietário; um trigger em `auth.users` cria `user_roles(admin)` para todo usuário novo.
2. A proprietária abre Usuários: aparece como "Proprietário", sem lixeira e sem seletor; os demais aparecem como "Admin" com lixeira.
3. Ela convida um e-mail: o `manage-users` (autorizado por papel proprietário ou admin) envia o convite; ao aceitar, o usuário já tem papel admin pelo trigger e aparece na lista como "Admin".
4. Um admin logado também consegue convidar e remover outros admins, mas não o proprietário.

### Edge Cases
- Já existir mais de uma linha `admin` na hora da migration: só a mais antiga vira proprietário (hoje há exatamente uma).
- Usuário antigo sem linha em `user_roles`: a tela mostra "Sem papel" e o seletor permite marcar como Admin (único item).
- Tentar remover a si mesmo: a lixeira fica desabilitada.
- Apagar o usuário do proprietário direto no Auth (service role): o cascade em `user_roles` dispara o trigger de proteção e a operação falha, que é o comportamento desejado.
- Papel `vendedor` remanescente: convertido para `admin` pela migration antes de trocar o CHECK (hoje não existe nenhum).

### Cenário de Erro
- `manage-users` chamado por usuário sem papel: 403 `Forbidden`.
- `manage-users` com `action=delete` do proprietário: 403 com mensagem "O proprietário não pode ser removido".
- Insert/update em `user_roles` com papel inválido: erro de CHECK; a tela mostra toast de erro.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-01 | automática | `src/test/integration/user-roles.integration.test.ts` | inserir papel `vendedor` ou `proprietário` (com acento) para um usuário temporário é recusado pelo banco; `admin` é aceito |
| CA-S1-02 | automática | `src/test/integration/user-roles.integration.test.ts` | existe exatamente uma linha `proprietario` e ela pertence ao usuário mais antigo da base |
| CA-S1-03 | automática | `src/test/integration/user-roles.integration.test.ts` + `src/lib/roles.test.ts` | banco recusa UPDATE e DELETE na linha do proprietário mesmo com service role; `manage-users delete` do proprietário responde 403; regras de tela (`canDeleteUser`, `canEditRole`) negam ação sobre o proprietário |
| CA-S1-04 | automática | `src/test/integration/user-roles.integration.test.ts` | criar um usuário novo no Auth faz aparecer, sem nenhuma outra chamada, uma linha `user_roles` com `admin` para ele |
| CA-S1-05 | automática | `src/test/integration/user-roles.integration.test.ts` + `src/test/authorize.test.ts` | `manage-users list` responde 200 para admin temporário e 403 para usuário sem papel; `clear-crm` responde 403 para usuário sem papel; a função compartilhada de autorização aceita `proprietario` e `admin` e recusa qualquer outro (o caminho "aceito" do `clear-crm` é provado pela unidade, porque executá-lo apagaria a base) |
| CA-S1-06 | manual | roteiro abaixo | seletor de papel só com "Admin"; proprietário sem seletor |

### Roteiro manual — CA-S1-06
1. Logar com a conta proprietária e abrir Configurações › Usuários.
2. Conferir que a própria linha mostra o selo "Proprietário", sem seletor e com a lixeira desabilitada.
3. Em qualquer outro usuário, abrir o seletor de papel: deve existir apenas a opção "Admin"; não existe "Vendedor" nem "Proprietário".
4. Conferir que não há nenhum texto "proprietário" com acento na tela.

## Banco de Dados

- Tabela: `user_roles` (existente)
  - `role` (text): CHECK passa a `role IN ('proprietario', 'admin')`; linhas `vendedor` viram `admin`; a linha `admin` mais antiga vira `proprietario` quando não há proprietário.
  - índice único parcial `uq_user_roles_proprietario` em `(role) WHERE role = 'proprietario'`: no máximo um proprietário.
  - trigger `trg_user_roles_protect_owner` (BEFORE UPDATE OR DELETE): recusa mexer na linha do proprietário.
  - policies de INSERT/UPDATE/DELETE passam a aceitar `role IN ('proprietario','admin')`.
- Tabela: `auth.users` (existente)
  - trigger `trg_auth_users_default_role` (AFTER INSERT, função SECURITY DEFINER): insere `user_roles(user_id, 'admin')` para todo usuário novo.

## Arquivos

- **Criar:** `supabase/migrations/20261101130000_roles_proprietario_admin.sql`: CHECK, conversão da conta atual, índice único, triggers e policies.
- **Criar:** `supabase/functions/_shared/authorize.ts`: `CRM_ROLES` e `getCrmRole(client, userId)`, usados por `manage-users` e `clear-crm` (sem Deno, testável).
- **Criar:** `src/test/authorize.test.ts`: unidade da autorização compartilhada (aceita proprietario/admin, recusa outros e ausência).
- **Criar:** `src/lib/roles.ts`: `ROLE_LABELS`, `ROLE_OPTIONS`, `canManageUsers`, `canEditRole`, `canDeleteUser` (regras puras da tela).
- **Criar:** `src/lib/roles.test.ts`: unidade das regras da tela.
- **Criar:** `src/test/integration/supabase-admin.ts`: lê `.env`, expõe client service-role, helpers para criar/apagar usuário temporário e obter JWT; pula quando sem credenciais.
- **Criar:** `src/test/integration/user-roles.integration.test.ts`: provas CA-S1-01 a 05 contra o banco.
- **Modificar:** `supabase/functions/manage-users/index.ts`: usa `getCrmRole`; recusa `delete` do proprietário; `list` devolve o papel de cada usuário.
- **Modificar:** `supabase/functions/clear-crm/index.ts`: usa `getCrmRole` (aceita proprietário e admin).
- **Modificar:** `src/pages/UsersPage.tsx`: usa `src/lib/roles.ts`; remove "vendedor" e "proprietário" com acento; seletor só com Admin; lixeira desabilitada para proprietário e para si; admins também gerenciam.

## Dependências Externas

Nenhuma nova.

## Checklist

- [x] Migration: `vendedor`→`admin`, admin mais antigo→`proprietario`, trocar CHECK, índice único, trigger de proteção, trigger de papel padrão em `auth.users`, policies com os dois papéis
- [x] `_shared/authorize.ts` e uso em `manage-users` e `clear-crm`
- [x] `manage-users`: 403 ao apagar proprietário; `list` devolve papel
- [x] `src/lib/roles.ts` e `UsersPage.tsx` sem vendedor/acento, seletor só Admin, admins gerenciam
- [x] Testes: `roles.test.ts`, `authorize.test.ts`, integração `user-roles.integration.test.ts`
- [x] `supabase db push`, `supabase functions deploy manage-users clear-crm`
- [x] Rodar integração contra produção e conferir que os usuários temporários foram apagados
