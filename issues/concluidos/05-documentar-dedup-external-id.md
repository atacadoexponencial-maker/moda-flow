# 05: Documentar uso de `external_id` na deduplicação

**Tipo:** Implementação (documentação)
**Módulo:** Preparação para deduplicação (Módulo 5 da spec)

## Descrição

Registrar em `atualizacoes-ajustes/deduplicacao-leads.md` que, quando a deduplicação for implementada, o `external_id` (agora capturado e indexado) deve ser o critério de identificação de duplicata de **maior prioridade**, antes de `email` e `whatsapp`.

## Critérios de aceite

- [x] Atualizar a seção "Critérios de Identificação de Duplicata" do doc de dedup, colocando `external_id` como prioridade 1 (quando presente), seguido de email e whatsapp.
- [x] Deixar explícito que esta feature **não** implementa a deduplicação — apenas persiste e indexa o `external_id`; leads continuam sendo inseridos normalmente mesmo com `external_id` repetido.
- [x] Nenhuma alteração de código nesta issue.

## Dependência

- Conceitual: issue 01 (índice em `external_id`).

---

## Plano

### Arquivos

- **Modificar:** `atualizacoes-ajustes/deduplicacao-leads.md` — na seção "Critérios de Identificação de Duplicata", inserir `external_id` como prioridade 1 e adicionar nota de que esta feature só persiste/indexa (não deduplica).

### Checklist

- [x] Reordenar critérios: 1) `external_id`, 2) email, 3) whatsapp.
- [x] Adicionar nota explícita de escopo (persistir ≠ deduplicar).
- [x] Nenhuma alteração de código.
