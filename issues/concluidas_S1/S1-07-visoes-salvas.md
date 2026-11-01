# S1-07: Visões salvas de filtros

**Tipo:** Implementação
**Página:** Pipeline e Leads
**Spec:** `spec-operacao-comercial.md`

## Descrição

Permitir salvar a combinação de filtros com um nome, reabrir, renomear e excluir visões próprias; oferecer visões prontas ("Leads Hoje", "Meus leads", uma por funil existente) não editáveis; lembrar a última visão usada por página. Visões são pessoais.

## Pronto quando

Aplicar filtros, salvar como "Workshop quente", sair e voltar: a visão está aplicada e aparece no seletor junto das prontas; outro usuário não a vê; "Leads Hoje" não oferece renomear/excluir.

## Critérios de aceite

- **CA-S1-27** (automática) — Salvar e reabrir visão. Dado filtros aplicados no Pipeline, quando o usuário salva como "Workshop quente" e depois seleciona essa visão, então os mesmos filtros são aplicados e a lista corresponde.
- **CA-S1-28** (automática) — Visões prontas disponíveis. Dado um usuário novo sem visões salvas, quando abre o seletor, então vê "Leads Hoje", "Meus leads" e uma visão por funil existente na base.
- **CA-S1-29** (automática) — Visões são pessoais. Dado uma visão salva pelo usuário A, quando o usuário B abre o seletor, então não vê a visão de A.
- **CA-S1-30** (automática) — Última visão reabre. Dado o usuário usou a visão "Workshop quente" e saiu da página, quando volta ao Pipeline, então a visão "Workshop quente" está aplicada.
- **CA-S1-31** (automática) — Visão pronta não é editável. Dado a visão "Leads Hoje" selecionada, quando o usuário procura renomear ou excluir, então as ações não estão disponíveis.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
Nenhuma.

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-02 | As visões prontas por funil devem ser uma por valor de funil existente na base (hoje 7) ou só os funis principais (Sessão Estratégica, Lives, Workshop)? | respondida | Uma por funil existente na base; novos funis aparecem sozinhos. Marcelle, 2026-11-01. |

## Cenários

### Happy Path
1. A migration cria `saved_views` (usuário, página, nome, filtros em JSON), com RLS por usuário e nome único por página.
2. Ao lado dos filtros do Pipeline e da tabela de Leads aparece o seletor "Visões": "Sem visão", as prontas (Leads Hoje, Meus leads, uma por funil) e as minhas.
3. A pessoa aplica filtros e clica em salvar: dá um nome, a visão entra em "Minhas" já selecionada. Escolher uma visão aplica os filtros; renomear e excluir só aparecem para visão própria.
4. Ao voltar à página, a última visão usada reabre sozinha (memória por usuário e página).

### Edge Cases
- Nome repetido na mesma página: aviso "Já existe uma visão com esse nome".
- Visão salva antes de um filtro novo existir: abre com o padrão para a chave nova.
- Usuário sem visões: só as prontas aparecem; os funis das prontas vêm dos leads carregados.
- Última visão lembrada foi excluída: nada é aplicado e o seletor fica em "Sem visão".

### Cenário de Erro
- Falha ao salvar/renomear/excluir: toast de erro e o estado anterior permanece.
- Armazenamento do navegador indisponível: sem memória da última visão, sem erro na tela.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-27 | automática | `src/lib/saved-views.test.ts` + `src/test/integration/saved-views.integration.test.ts` | os filtros serializados e lidos de volta são idênticos aos aplicados (unidade) e isso vale com a gravação real no banco (integração) |
| CA-S1-28 | automática | `src/lib/saved-views.test.ts` | as visões prontas são Leads Hoje, Meus leads e uma por funil existente, com os filtros certos |
| CA-S1-29 | automática | `src/test/integration/saved-views.integration.test.ts` | a visão de A não é listada para B, B não altera nem cria em nome de A |
| CA-S1-30 | automática | `src/lib/saved-views.test.ts` | a última visão fica lembrada por usuário e página e é lida de volta ao voltar |
| CA-S1-31 | automática | `src/lib/saved-views.test.ts` | visão pronta é identificada como não editável (sem renomear/excluir) |

## Banco de Dados

- Tabela `saved_views`: `id`, `user_id` (FK auth.users, cascade), `page` (pipeline | leads), `name` (≤ 60), `filters` (jsonb), `created_at`, `updated_at`; única por (usuário, página, nome). RLS: cada usuário só vê e mexe nas próprias.

## Arquivos

- **Criar:** `supabase/migrations/20261101180000_saved_views.sql`
- **Criar:** `src/lib/saved-views.ts`: serialização, visões prontas, memória da última visão, validação de nome.
- **Criar:** `src/lib/saved-views.test.ts`
- **Criar:** `src/hooks/useSavedViews.ts`: listar, salvar, renomear e excluir visões próprias.
- **Criar:** `src/components/leads/SavedViewsSelect.tsx`: seletor, salvar/renomear/excluir e reabertura da última visão.
- **Criar:** `src/test/integration/saved-views.integration.test.ts`
- **Modificar:** `src/pages/PipelinePage.tsx`: seletor de visões ao lado dos filtros.
- **Modificar:** `src/pages/LeadsPage.tsx`: idem.
- **Modificar:** `src/integrations/supabase/types.ts`: regenerado (nova tabela).

## Dependências Externas

Nenhuma nova.

## Checklist

- [x] Migration aplicada e tipos regenerados
- [x] `saved-views.ts` + testes
- [x] Hook e componente de visões
- [x] Seletor nas páginas Pipeline e Leads
- [x] Integração rodada contra produção com limpeza conferida
