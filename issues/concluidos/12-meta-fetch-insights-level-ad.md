# 12: Sincronização Meta Ads — Buscar insights por conjunto e criativo

**Tipo:** Implementação
**Página:** Sincronização de conjuntos e criativos (Meta Ads)

## Descrição

Ampliar a Edge Function `meta-fetch-insights` para também buscar insights com `level=ad` (trazendo adset e ad) e gravar o detalhamento na tabela `meta_ads_insights`, mantendo a sincronização por campanha existente.

## Cenários

### Happy Path
1. A função autentica (usuário logado ou `x-cron-secret`), obtém o token do Vault e renova se necessário — fluxo existente inalterado.
2. Busca insights `level=campaign` (fluxo atual) e grava em `meta_ads_cache`.
3. Busca insights `level=ad` com `fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks`, `date_preset=last_90d`, `time_increment=1`, `limit=500`, paginando via `paging.next`.
4. Limpa `meta_ads_insights` e insere as novas linhas em lotes de 500 (mesmo padrão do cache de campanhas).
5. Retorna `{ success: true, campaigns_synced, ads_synced }`.
6. Deploy via `supabase functions deploy meta-fetch-insights`.

### Edge Cases
- Conta sem anúncios ativos no período: `level=ad` retorna vazio — tabela fica vazia, resposta com `ads_synced: 0`.
- Paginação longa (muitos anúncios × 90 dias): loop de paginação já existente cobre; lotes de 500 no insert.
- Campos ausentes na resposta (spend/clicks): parse com fallback "0", como no fluxo de campanha.

### Cenário de Erro
- Erro da API do Meta no fetch de `level=ad`: manter o resultado de campanhas já gravado e retornar o erro com o detalhe (`ads_error`), sem falhar a sincronização de campanhas — o nível de anúncio é aditivo.
- Erro de insert: logar e continuar (mesmo comportamento do fluxo atual).

## Banco de Dados

- Tabela: `meta_ads_insights` — escrita (delete + insert) via service role. Criada na issue 11.

## Arquivos

- **Modificar:** `supabase/functions/meta-fetch-insights/index.ts` — adicionar fetch `level=ad` e gravação em `meta_ads_insights`; resposta passa a incluir `ads_synced`

## Dependências Externas

- Meta Marketing API v19.0 — endpoint `/{ad_account_id}/insights` com `level=ad` (mesmo endpoint já usado; sem escopo OAuth novo, `ads_read` já cobre)

## Checklist

- [x] Adicionar fetch `level=ad` com paginação após o fluxo de campanhas
- [x] Gravar em `meta_ads_insights` (delete + insert em lotes de 500)
- [x] Incluir `ads_synced` na resposta; erro de ads não derruba sync de campanhas
- [x] Deploy com `supabase functions deploy meta-fetch-insights`
- [x] Executar a função e conferir que `meta_ads_insights` foi populada (1.353 linhas)
