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
