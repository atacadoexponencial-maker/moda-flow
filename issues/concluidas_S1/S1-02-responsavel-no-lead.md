# S1-02: Responsável pelo lead (campo, painel, card e tabela)

**Tipo:** Implementação
**Página:** Pipeline, Leads e painel do lead
**Spec:** `spec-operacao-comercial.md`

## Descrição

Dar ao lead um responsável (usuário do time): seletor e botão "Assumir" no painel, iniciais no card do pipeline e coluna na tabela de Leads; troca registrada na linha do tempo com quem fez; remoção de usuário deixa os leads sem responsável.

## Pronto quando

Abrir um lead, escolher um responsável ou clicar em Assumir, e ver o nome no painel, as iniciais no card e a coluna na tabela; a linha do tempo mostra a troca; remover um usuário não apaga lead algum.

## Critérios de aceite

- **CA-S1-07** (automática) — Definir responsável no painel. Dado um lead sem responsável aberto no painel, quando o usuário escolhe um nome no campo Responsável, então o lead passa a mostrar esse responsável no painel, no card do pipeline e na tabela, e a troca fica registrada na linha do tempo do lead.
- **CA-S1-08** (automática) — "Assumir" atribui ao usuário logado. Dado um lead sem responsável, quando o usuário clica em "Assumir", então ele passa a ser o responsável do lead.
- **CA-S1-12** (automática) — Remover usuário não apaga leads. Dado um usuário responsável por leads, quando ele é removido do time, então os leads continuam existindo e passam a "Sem responsável".

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-02 | Toda atividade passa a registrar quem a criou (hoje o campo existe mas fica vazio), inclusive as geradas pelo sistema ("Lead voltou", troca de responsável), que ficam como "Sistema". | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-03 | O responsável deve ser visível no card do pipeline (iniciais) ou só no painel e na tabela, para manter o card limpo? | respondida | Sim, iniciais no card. Marcelle, 2026-11-01. |

## Cenários

### Happy Path
1. A migration cria `leads.assigned_to` (referência ao usuário, `ON DELETE SET NULL`), a função `team_members()` que lista os usuários do time (id, e-mail, papel) para o seletor, o trigger que registra na linha do tempo toda troca de responsável e o trigger que preenche `activities.created_by` com o e-mail de quem está logado (ou "Sistema").
2. No painel do lead, a seção Pipeline ganha o campo "Responsável": seletor com os membros do time e "Sem responsável", mais o botão "Assumir" quando o lead não é do usuário logado.
3. Ao escolher alguém, o lead salva, a linha do tempo mostra "Responsável definido: fulano" (com quem fez), o card do pipeline passa a exibir as iniciais e a tabela mostra a coluna Responsável.
4. Ao remover um usuário pela tela de Usuários, os leads dele ficam "Sem responsável" e cada um ganha o registro "Responsável removido" assinado por "Sistema".

### Edge Cases
- Lead sem responsável: card sem iniciais; tabela mostra "—"; painel mostra "Sem responsável" e o botão "Assumir".
- Trocar para o mesmo responsável: nada é gravado nem registrado.
- Usuário do seletor que acabou de ser removido: a lista é recarregada ao abrir o painel; se ainda aparecer e a gravação falhar por referência inválida, a tela mostra erro.
- Nome de exibição: parte do e-mail antes do `@`, com iniciais das duas primeiras partes separadas por ponto, hífen ou underline (ex.: `ana.souza@…` → "AS"; `marcelle@…` → "MA").

### Cenário de Erro
- Falha ao salvar o responsável: toast "Erro ao salvar" e o valor anterior permanece.
- `team_members()` indisponível: seletor mostra só "Sem responsável" e o botão "Assumir" continua funcionando (usa o id do usuário logado).

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-07 | automática | `src/test/integration/lead-assignment.integration.test.ts` + `src/lib/team.test.ts` | ao gravar `assigned_to` num lead, a linha do tempo recebe "Responsável definido" com o nome do novo responsável e o autor; `team_members()` devolve o usuário para o seletor; as iniciais e o nome exibidos no card/tabela saem das regras de `team.ts` |
| CA-S1-08 | automática | `src/lib/team.test.ts` + `src/test/integration/lead-assignment.integration.test.ts` | a regra "Assumir" monta o patch com o id do usuário logado e só aparece quando o lead não é dele; gravar esse patch deixa o lead com o usuário como responsável |
| CA-S1-12 | automática | `src/test/integration/lead-assignment.integration.test.ts` | apagar o usuário responsável mantém o lead, zera o responsável e registra "Responsável removido" por "Sistema" |

## Banco de Dados

- Tabela: `leads` (existente)
  - `assigned_to` (uuid, nulo, referência `auth.users(id) ON DELETE SET NULL`), com índice.
  - trigger `trg_leads_assignment_activity` (AFTER UPDATE OF assigned_to): insere em `activities` tipo `assignment` com "Responsável definido: <nome>" / "Responsável removido" / "Responsável alterado de <a> para <b>".
- Tabela: `activities` (existente)
  - CHECK de `type` passa a incluir `assignment`.
  - trigger `trg_activities_created_by` (BEFORE INSERT): `created_by` = e-mail do JWT quando vazio; "Sistema" quando não há usuário (service role, triggers em cascata).
- Função: `public.team_members()` (SECURITY DEFINER, EXECUTE para `authenticated`): devolve `user_id`, `email`, `role` de `user_roles` unido a `auth.users`.
- Tabela: `lead_field_definitions` (existente): nova linha de sistema `assigned_to` / "Responsável" (sort_order 9), para a coluna entrar no controle de colunas da tabela.

## Arquivos

- **Criar:** `supabase/migrations/20261101140000_lead_assigned_to.sql`: coluna, índice, função `team_members`, triggers e seed da coluna.
- **Criar:** `src/lib/team.ts`: `displayName(email)`, `initials(email)`, `assigneeLabel(members, id)`, `canAssume(lead, userId)`, `assignPatch(userId)` (regras puras de exibição e do botão Assumir).
- **Criar:** `src/lib/team.test.ts`: unidade das regras acima.
- **Criar:** `src/hooks/useTeamMembers.ts`: consulta `team_members()` via React Query, com cache compartilhado entre painel, card e tabela.
- **Criar:** `src/test/integration/lead-assignment.integration.test.ts`: provas contra o banco (lead temporário + usuário temporário, limpos ao final).
- **Modificar:** `src/components/pipeline/LeadDetailPanel.tsx`: campo Responsável (seletor + Assumir) na seção Pipeline.
- **Modificar:** `src/components/pipeline/LeadActivities.tsx`: ícone e rótulo do tipo `assignment`.
- **Modificar:** `src/pages/PipelinePage.tsx`: iniciais do responsável no card.
- **Modificar:** `src/pages/LeadsPage.tsx`: coluna Responsável (ordenável, no controle de colunas e no CSV).
- **Modificar:** `src/integrations/supabase/types.ts`: regenerado após a migration (nova coluna e função).

## Dependências Externas

Nenhuma nova.

## Checklist

- [x] Migration: `assigned_to`, `team_members()`, trigger de atividade de atribuição, trigger de `created_by`, CHECK de `activities.type`, seed da coluna
- [x] `src/lib/team.ts` + testes
- [x] `useTeamMembers` + campo Responsável/Assumir no painel
- [x] Iniciais no card do pipeline e coluna na tabela (com CSV)
- [x] Rótulo do tipo `assignment` na linha do tempo
- [x] `supabase db push` + regenerar `types.ts`
- [x] Integração rodada contra produção com limpeza conferida
