# S1-03: Filtro por responsável e "Meus leads" (Pipeline, Leads e Hoje)

**Tipo:** Implementação
**Página:** Pipeline, Leads e Hoje
**Spec:** `spec-operacao-comercial.md`

## Descrição

Acrescentar o filtro Responsável (pessoa, "Sem responsável") com o atalho "Meus leads" nos filtros do Pipeline e da tabela de Leads, e a alternância Meus/Todos na página Hoje.

## Pronto quando

Com leads de responsáveis variados, ativar "Meus leads" no Pipeline e na tabela mostra só os do usuário logado; escolher outra pessoa ou "Sem responsável" filtra certo; em Hoje, "Meus" restringe Atrasados, Para hoje e Reuniões.

## Critérios de aceite

- **CA-S1-09** (automática) — Filtro "Meus leads". Dado leads com responsáveis variados e alguns sem responsável, quando o usuário ativa "Meus leads" no Pipeline ou na tabela de Leads, então só aparecem os leads em que ele é o responsável.
- **CA-S1-10** (automática) — Filtro por responsável e por "sem responsável". Dado o filtro Responsável, quando o usuário escolhe outra pessoa ou "Sem responsável", então a lista mostra só os leads correspondentes.
- **CA-S1-11** (automática) — Hoje alterna entre meus e todos. Dado follow-ups atrasados e de hoje de vários responsáveis, quando o usuário alterna para "Meus", então as três listas (Atrasados, Para hoje, Reuniões) mostram só os leads dele; em "Todos" voltam a mostrar tudo.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
Nenhuma.

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.

## Cenários

### Happy Path
1. O estado de filtros ganha "Responsável" com os valores: todos, meus leads, sem responsável ou um membro específico.
2. Na barra de filtros (Pipeline e Leads) aparece o atalho "Meus leads" ao lado da busca e, dentro do popover, o seletor "Responsável" com os membros do time.
3. Ao ativar "Meus leads", só aparecem os leads cujo responsável é o usuário logado; o contador de filtros ativos sobe; "Limpar" volta a todos.
4. Na página Hoje, uma alternância "Meus / Todos" no cabeçalho restringe Atrasados, Para hoje e Reuniões aos leads do usuário.

### Edge Cases
- Usuário sem leads atribuídos ativa "Meus leads": listas vazias com a mensagem padrão de vazio.
- "Sem responsável" lista só leads com responsável vazio.
- Membro removido do time: o filtro por ele deixa de aparecer no seletor; leads que eram dele já estão como "Sem responsável" (S1-02).
- Em Hoje, a alternância padrão é "Todos" (nada muda para quem não usa o recurso).

### Cenário de Erro
- Lista de membros indisponível: o seletor mostra só "Todos", "Meus leads" e "Sem responsável"; o atalho continua funcionando.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-09 | automática | `src/lib/leads-filter-utils.test.ts` | com leads de responsáveis variados e sem responsável, o filtro "meus leads" devolve só os do usuário logado, nas regras usadas por Pipeline e Leads |
| CA-S1-10 | automática | `src/lib/leads-filter-utils.test.ts` | filtrar por outra pessoa devolve só os dela; "sem responsável" devolve só os vazios; "todos" não filtra |
| CA-S1-11 | automática | `src/lib/leads-filter-utils.test.ts` | a regra de Hoje em modo "Meus" restringe as três listas (atrasados, para hoje, reuniões) aos leads do usuário e em "Todos" devolve tudo |

## Banco de Dados

Nenhuma mudança (usa `leads.assigned_to` da S1-02).

## Arquivos

- **Modificar:** `src/components/leads/LeadsFilters.tsx`: campo `assignedTo` no estado, atalho "Meus leads", seletor "Responsável" no popover, contador e limpar.
- **Modificar:** `src/lib/leads-filter-utils.ts`: `applyLeadFilters` recebe o usuário logado para resolver "meus leads"; nova `applyAssigneeFilter` reutilizada por Hoje.
- **Modificar:** `src/lib/leads-filter-utils.test.ts`: testes dos três critérios.
- **Modificar:** `src/pages/PipelinePage.tsx`: passa o usuário logado ao filtro.
- **Modificar:** `src/pages/LeadsPage.tsx`: passa o usuário logado ao filtro; corrige dependência `members` na ordenação (aviso de lint da S1-02).
- **Modificar:** `src/pages/HojePage.tsx`: alternância Meus/Todos aplicada às três listas.

## Dependências Externas

Nenhuma nova.

## Checklist

- [x] Estado e UI do filtro Responsável + atalho "Meus leads" em `LeadsFilters`
- [x] `applyLeadFilters` com usuário logado e `applyAssigneeFilter`
- [x] Pipeline e Leads passam o usuário logado
- [x] Hoje com alternância Meus/Todos
- [x] Testes dos três critérios passando
