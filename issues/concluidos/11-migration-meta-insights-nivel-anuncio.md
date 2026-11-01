# 11: Migration — Insights do Meta Ads no nível de anúncio

**Tipo:** Implementação
**Página:** Sincronização de conjuntos e criativos (dados)

## Descrição

Criar a estrutura de armazenamento para insights diários do Meta Ads no nível de anúncio: campanha, conjunto (adset_id/adset_name), anúncio (ad_id/ad_name), investimento, cliques e impressões. Regenerar os types do Supabase.

## Cenários

### Happy Path
1. Migration cria a tabela `meta_ads_insights` com RLS habilitado (leitura para usuários autenticados; escrita apenas via service role da Edge Function).
2. `supabase db push` aplica a migration na instância `ynjxvzjomizfyabupvne`.
3. `supabase gen types` regenera `src/integrations/supabase/types.ts` com a nova tabela.

### Edge Cases
- Migration reaplicada: usar `CREATE TABLE IF NOT EXISTS` e `DROP POLICY IF EXISTS` antes de criar policies, para ser idempotente.
- Nenhum dado ainda: tabela vazia é estado válido — o dashboard trata como "sem dados".

### Cenário de Erro
- `db push` falha (rede/credencial): nada é aplicado parcialmente — migration é uma transação única; reportar o erro e não regenerar types.

## Banco de Dados

- Tabela: `meta_ads_insights` (nível anúncio, uma linha por anúncio POR DIA — espelha o padrão de `meta_ads_cache`)
  - `id` (uuid, PK, default gen_random_uuid())
  - `fetched_at` (timestamptz, default now())
  - `date_start` (date) — dia do insight
  - `date_stop` (date)
  - `campaign_id` (text), `campaign_name` (text)
  - `adset_id` (text), `adset_name` (text)
  - `ad_id` (text), `ad_name` (text)
  - `spend` (numeric), `impressions` (integer), `clicks` (integer)
  - Índices: `date_start`, `ad_id`
  - RLS: SELECT para `authenticated`; sem policies de escrita (a Edge Function usa service role, que ignora RLS)

## Arquivos

- **Criar:** `supabase/migrations/20260702120000_meta_ads_insights_ad_level.sql` — cria tabela, índices e RLS
- **Modificar:** `src/integrations/supabase/types.ts` — regenerado via CLI (não editar manualmente)

## Checklist

- [x] Criar migration com tabela `meta_ads_insights`, índices e RLS
- [x] Aplicar com `supabase db push`
- [x] Regenerar types com `supabase gen types typescript --project-id ynjxvzjomizfyabupvne`
