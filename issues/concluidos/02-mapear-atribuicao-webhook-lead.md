# 02: Mapear atribuição no `webhook-lead`

**Tipo:** Implementação
**Módulo:** webhook-lead (Módulo 2 da spec)

## Descrição

Na função `supabase/functions/webhook-lead/index.ts`, dentro de `mapPayloadToLead`, mapear os campos de atribuição do payload (`fbc`, `gclid`, `external_id`, `utm_term`/alias `term`) para as novas colunas, sem alterar o mapeamento dos campos já existentes.

## Critérios de aceite

- [x] `record.fbc = get("fbc") ?? null`
- [x] `record.gclid = get("gclid") ?? null`
- [x] `record.external_id = get("external_id") ?? null`
- [x] `record.utm_term = get("utm_term", "term") ?? null`
- [x] Campos ausentes ou vazios viram `null` (a função `get` já ignora `""`/`null`/`undefined`).
- [x] Mapeamento dos demais campos permanece intacto.
- [x] Payloads com campos extras não mapeados continuam sendo aceitos sem erro.

## Dependência

- Issue 01 (colunas precisam existir no banco).

---

## Plano

### Cenários

- **Happy path:** payload traz `{ "nome": "X", "gclid": "abc", "external_id": "u123" }` → `record` inclui `gclid: "abc"`, `external_id: "u123"`, demais de atribuição `null`.
- **Edge case:** payload manda `utm_term: ""` → `get` ignora string vazia → `null`. Payload manda `term` em vez de `utm_term` → capturado pelo alias.
- **Erro:** nenhum novo caminho de erro; campos desconhecidos continuam ignorados sem falhar o insert.

### Arquivos

- **Modificar:** `supabase/functions/webhook-lead/index.ts` — em `mapPayloadToLead`, após a linha de `utm_content`, adicionar 4 atribuições reutilizando o helper `get` existente.

### Trecho previsto (dentro de `mapPayloadToLead`)

```ts
record.utm_term = get("utm_term", "term") ?? null;
record.fbc = get("fbc") ?? null;
record.gclid = get("gclid") ?? null;
record.external_id = get("external_id") ?? null;
```

### Checklist

- [x] Adicionar as 4 linhas usando o helper `get` (sem criar função nova).
- [x] Confirmar que nenhum campo existente foi alterado.
- [x] Verificar que a coluna do payload bate exatamente com o nome da coluna do banco.
