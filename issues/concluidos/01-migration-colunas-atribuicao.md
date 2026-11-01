# 01: Migration — Colunas de atribuição na tabela `leads`

**Tipo:** Implementação
**Módulo:** Schema (Módulo 1 da spec)

## Descrição

Criar uma migration que adiciona à tabela `leads` as colunas `fbc`, `gclid`, `external_id` e `utm_term` (texto, opcionais) e um índice parcial sobre `external_id` (ignorando nulos/vazios) para busca eficiente na futura deduplicação.

## Critérios de aceite

- [x] Migration adiciona `fbc TEXT`, `gclid TEXT`, `external_id TEXT`, `utm_term TEXT` em `public.leads` com `ADD COLUMN IF NOT EXISTS`.
- [x] Nenhuma coluna é `NOT NULL`; leads existentes permanecem válidos com as colunas vazias.
- [x] Cria índice em `external_id` ignorando valores nulos (ex.: índice parcial `WHERE external_id IS NOT NULL`).
- [x] Arquivo nomeado no padrão `supabase/migrations/<timestamp>_add_attribution_columns.sql`.
- [x] É a primeira issue a ser implementada — as demais dependem das colunas existirem.

## Fora de escopo

- Editar `src/integrations/supabase/types.ts` (auto-gerado; regenerar com `supabase gen types` após aplicar).

---

## Plano

### Banco de Dados

- Tabela: `public.leads`
  - `fbc` (TEXT, nullable) — cookie `_fbc` do Facebook
  - `gclid` (TEXT, nullable) — Google Click Identifier
  - `external_id` (TEXT, nullable) — identificador estável do lead na origem
  - `utm_term` (TEXT, nullable) — termo/palavra-chave da campanha
  - Índice parcial `idx_leads_external_id` em `external_id WHERE external_id IS NOT NULL`

### Cenários

- **Happy path:** migration roda em produção via `supabase db push`; colunas e índice criados; leads existentes ganham as colunas vazias.
- **Edge case:** migration reaplicada → `IF NOT EXISTS` evita erro.
- **Erro:** se já existir coluna com mesmo nome de tipo diferente, `ADD COLUMN IF NOT EXISTS` ignora silenciosamente (não há colisão conhecida hoje).

### Arquivos

- **Criar:** `supabase/migrations/20260615000000_add_attribution_columns.sql` — adiciona as 4 colunas + índice parcial.

### Conteúdo previsto

```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_external_id
  ON public.leads (external_id)
  WHERE external_id IS NOT NULL;
```

### Checklist

- [x] Criar a migration com as 4 colunas (`ADD COLUMN IF NOT EXISTS`).
- [x] Adicionar o índice parcial em `external_id`.
- [x] Aplicar com `supabase db push`.
- [x] Regenerar `types.ts` com `supabase gen types typescript --linked > src/integrations/supabase/types.ts`.
