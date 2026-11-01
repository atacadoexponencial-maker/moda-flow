# 03: Reconhecer atribuição no `import-csv`

**Tipo:** Implementação
**Módulo:** import-csv (Módulo 3 da spec)

## Descrição

Na função `supabase/functions/import-csv/index.ts`, dentro de `getAutoMapping`, adicionar o reconhecimento automático de colunas de cabeçalho correspondentes a `fbc`, `gclid`, `external_id` e `utm_term`, mapeando-as para as novas colunas do lead.

## Critérios de aceite

- [x] Cabeçalho normalizado contendo `fbc` → campo `fbc`.
- [x] Cabeçalho contendo `gclid` → campo `gclid`.
- [x] Cabeçalho contendo `external_id` ou `external id` → campo `external_id`.
- [x] Cabeçalho contendo `utm_term` ou `term` → campo `utm_term`.
- [x] Células vazias resultam em `null` (comportamento padrão do `buildRecord` para campos de texto).
- [x] Mapeamentos existentes (nome, status, datas, UTMs atuais, flags) permanecem inalterados.
- [x] CSVs sem essas colunas continuam importando normalmente.

## Atenção

- As novas condições de `else if` devem ser posicionadas de modo a não conflitar com regras existentes (ex.: `utm_term`/`term` não pode ser capturado pela regra de `utm_medium`/`source`).

## Dependência

- Issue 01 (colunas precisam existir no banco).

---

## Plano

### Cenários

- **Happy path:** CSV com colunas `external_id`, `gclid` → `getAutoMapping` cria mappings para `external_id`/`gclid`; `buildRecord` grava os valores; células vazias viram `null`.
- **Edge case:** cabeçalho `External ID` (com espaço/maiúsculas) → `normalizeHeader` produz `external id` → casa pela condição `includes("external id")`. Cabeçalho `fbclid` **não** deve casar com `fbc` (usar igualdade, não `includes`).
- **Erro:** CSV sem nenhuma dessas colunas → nenhum mapping novo; importação segue normal.

### Arquivos

- **Modificar:** `supabase/functions/import-csv/index.ts` — em `getAutoMapping`, adicionar 4 condições `else if` na cadeia, próximas às demais regras de UTM. `buildRecord` **não** muda (campos de texto já caem no ramo `raw || null`).

### Trechos previstos (dentro de `getAutoMapping`, na cadeia de `else if`)

```ts
else if (norm.includes("utm_term") || norm === "term") field = "utm_term";
else if (norm === "fbc") field = "fbc";
else if (norm.includes("gclid")) field = "gclid";
else if (norm.includes("external_id") || norm.includes("external id")) field = "external_id";
```

> Ordem importa: posicionar **antes** da regra genérica de `utm_campaign` (`norm.includes("utm") && ...`) não é necessário porque nenhum desses contém "campaign", mas manter junto das demais regras UTM por coesão. Usar `norm === "fbc"` (igualdade) para não capturar `fbclid`.

### Checklist

- [x] Adicionar as 4 condições na cadeia de `getAutoMapping`.
- [x] Garantir que `utm_term`/`term` não é capturado por `utm_medium`/`source` (não é, pois usam `includes("utm_medium")`/`=== "medium"`).
- [x] Garantir que `fbc` usa igualdade para não pegar `fbclid`.
- [x] Confirmar que `buildRecord` não precisa de alteração.
