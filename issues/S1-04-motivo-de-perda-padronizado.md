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
