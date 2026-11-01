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
