# S1-04: Motivo de perda padronizado

**Tipo:** Implementação
**Página:** Pipeline (mover para perdido) e painel do lead
**Spec:** `spec-operacao-comercial.md`

## Descrição

Trocar o motivo de perda por uma lista fixa com os 8 motivos do ClickUp mais "Outro" com texto, tanto na caixa de confirmação ao mover para Desqualificado/Proposta Recusada quanto no painel do lead.

## Pronto quando

Arrastar um lead para Desqualificado abre a lista com os 9 itens na ordem da spec, não deixa confirmar sem motivo, guarda o texto de "Outro"; no painel de um lead perdido o motivo é trocável pela mesma lista; motivos antigos continuam legíveis.

## Critérios de aceite

- **CA-S1-13** (automática) — Perda exige um motivo da lista. Dado um lead sendo movido para Desqualificado ou Proposta Recusada, quando o usuário tenta confirmar sem escolher motivo, ou escolhe "Outro" sem escrever, então a confirmação fica bloqueada.
- **CA-S1-14** (automática) — Lista de motivos é a do ClickUp. Dado a caixa de perda aberta, quando o usuário abre a lista de motivos, então vê exatamente os 8 motivos acima mais "Outro", nessa ordem.
- **CA-S1-15** (automática) — Motivo "Outro" guarda o texto escrito. Dado o usuário escolhe "Outro" e escreve um motivo, quando confirma, então o lead mostra o texto escrito como motivo de perda.
- **CA-S1-16** (automática) — Motivo editável no painel. Dado um lead perdido aberto no painel, quando o usuário troca o motivo pela lista, então o novo motivo fica salvo e aparece no painel.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-06 | Motivos de perda antigos (texto livre) não são convertidos para a nova lista; ficam como estão e aparecem como "Outro" com o texto. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.

## Cenários

### Happy Path
1. A lista fixa de motivos (8 do ClickUp + "Outro") passa a viver num módulo único, usado pela caixa de confirmação ao mover para Desqualificado/Proposta Recusada e pelo painel do lead.
2. Ao arrastar para um estágio perdido, a caixa mostra os 9 motivos na ordem da spec; "Confirmar" só habilita com um motivo escolhido (e texto, se "Outro").
3. No painel de um lead perdido, o campo "Motivo de perda" vira um seletor com a mesma lista; ao escolher "Outro" aparece a caixa de texto; o que é salvo é o texto.

### Edge Cases
- Lead perdido antes da mudança, com motivo em texto livre: o seletor mostra "Outro" e a caixa de texto traz o texto original (SUP-S1-06).
- Trocar de "Outro" para um motivo da lista: salva o motivo e esconde a caixa de texto.
- Escolher "Outro" e deixar a caixa vazia no painel: nada é salvo até digitar.
- Lead em estágio não perdido com motivo preenchido (histórico): o campo continua visível e editável.

### Cenário de Erro
- Falha ao salvar: toast "Erro ao salvar" e o valor anterior permanece.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-13 | automática | `src/lib/loss-reason.test.ts` | sem motivo, ou "Outro" sem texto, a regra de confirmação devolve inválido (botão bloqueado) |
| CA-S1-14 | automática | `src/lib/loss-reason.test.ts` | a lista é exatamente os 8 motivos do ClickUp mais "Outro", nessa ordem |
| CA-S1-15 | automática | `src/lib/loss-reason.test.ts` | "Outro" com texto resolve para o texto digitado, que é o que fica gravado |
| CA-S1-16 | automática | `src/lib/loss-reason.test.ts` | ao abrir um lead perdido, o seletor reflete o motivo gravado (item da lista → o próprio; texto livre → "Outro" com o texto); trocar pela lista gera o novo valor a salvar |

## Banco de Dados

Nenhuma mudança (`leads.loss_reason` continua texto; motivos antigos preservados).

## Arquivos

- **Criar:** `src/lib/loss-reason.ts`: `LOSS_REASONS`, `OTHER_LOSS_REASON`, `resolveLossReason(selected, otherText)`, `lossReasonSelectValue(stored)`, `lossReasonOtherText(stored)`.
- **Criar:** `src/lib/loss-reason.test.ts`: testes dos quatro critérios.
- **Modificar:** `src/components/pipeline/MoveDialog.tsx`: usa a lista e a regra de validação do módulo (remove a lista local antiga).
- **Modificar:** `src/components/pipeline/LeadDetailPanel.tsx`: campo "Motivo de perda" vira seletor + texto para "Outro".

## Dependências Externas

Nenhuma nova.

## Checklist

- [x] Módulo `loss-reason.ts` com lista e regras + testes
- [x] MoveDialog usando o módulo
- [x] Painel com seletor de motivo e texto para "Outro"
- [x] Lint e typecheck limpos
