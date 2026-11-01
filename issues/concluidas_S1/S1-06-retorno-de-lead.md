# S1-06: Retorno de lead: reabrir, registrar e destacar

**Tipo:** Implementação
**Página:** Pipeline, Leads, Hoje e painel do lead
**Spec:** `spec-operacao-comercial.md`

## Descrição

Quando a deduplicação registra uma nova entrada de um contato existente: voltar o lead para Leads de Entrada se estiver perdido, em Nutrição ou Follow-up Futuro (mantendo o responsável e guardando o motivo de perda no registro); criar "Lead voltou" na linha do tempo com funil e origem; mostrar selo "Voltou" por 7 dias no card e na tabela e uma seção "Voltaram" em Hoje. Retornos anteriores à mudança não mudam nada.

## Pronto quando

Enviar ao webhook um cadastro com o WhatsApp de um lead Desqualificado: ele reaparece em Leads de Entrada com selo "Voltou", consta em "Voltaram" na página Hoje e a linha do tempo mostra "Lead voltou" com funil/utm; um lead em Reunião recebendo o mesmo não muda de coluna, mas ganha o registro e o selo.

## Critérios de aceite

- **CA-S1-22** (automática) — Lead perdido que volta reabre em Leads de Entrada. Dado um lead em Desqualificado, Proposta Recusada, Nutrição ou Follow-up Futuro, quando chega um novo cadastro com o mesmo WhatsApp ou e-mail, então o lead passa para Leads de Entrada, o motivo de perda anterior fica guardado no registro da linha do tempo e o responsável é mantido.
- **CA-S1-23** (automática) — Lead em trabalho ou fechado que volta fica onde está. Dado um lead em Qualificação, Follow-up RA, Reunião, Proposta/Negociação, Follow-up RR, Contrato ou Contrato Assinado, quando chega um novo cadastro com a mesma identidade, então o estágio não muda.
- **CA-S1-24** (automática) — Registro "Lead voltou" na linha do tempo. Dado qualquer retorno de lead, quando o novo cadastro é processado, então a linha do tempo do lead mostra "Lead voltou" com o funil e a origem (utm_source/utm_campaign) da nova entrada.
- **CA-S1-25** (automática) — Destaque de quem voltou. Dado um lead que voltou dentro do período de destaque, quando o usuário abre o Pipeline, a tabela de Leads ou a página Hoje, então o lead aparece com o selo "Voltou" e consta na seção "Voltaram" de Hoje; passado o período, o selo some.
- **CA-S1-26** (automática) — Leads que já voltaram antes da mudança não ganham selo retroativo. Dado os 129 retornos já registrados na base, quando a mudança entra no ar, então nenhum lead muda de estágio nem ganha selo por retornos anteriores.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-02 | Toda atividade passa a registrar quem a criou (hoje o campo existe mas fica vazio), inclusive as geradas pelo sistema ("Lead voltou", troca de responsável), que ficam como "Sistema". | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-03 | Período de destaque "Voltou": 7 dias a partir do retorno. | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-05 | A regra de retorno vale para qualquer canal de entrada (webhook, importação, criação manual), porque todos passam pelo mesmo ponto de deduplicação. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-01 | Lead em Nutrição ou Follow-up Futuro que volta deve ir para Leads de Entrada (perde a data de próximo contato) ou só ganhar o selo e ficar onde está? | respondida | Volta para Leads de Entrada, igual ao ClickUp. Marcelle, 2026-11-01. |

## Cenários

### Happy Path
1. A migration acrescenta `leads.last_return_at`, o tipo `lead_voltou` em atividades e reescreve o trigger de deduplicação: além do touch de retorno, ele reabre o lead quando cabe, registra "Lead voltou" e marca o retorno.
2. Chega um novo cadastro (webhook, importação ou manual) de um lead Desqualificado: o lead volta para Leads de Entrada, sem motivo de perda e sem próximo contato, com o mesmo responsável; a linha do tempo mostra "Lead voltou pelo funil X (fonte / campanha) · reaberto de Desqualificado para Leads de Entrada · motivo de perda anterior: …".
3. O card no Pipeline e a linha na tabela mostram o selo "Voltou" por 7 dias; a página Hoje ganha a seção "Voltaram" com esses leads (respeitando Meus/Todos).
4. Lead em Reunião que volta: fica em Reunião, ganha o registro e o selo.

### Edge Cases
- Lead que volta duas vezes na semana: um registro por retorno; o selo conta a partir do último.
- Novo cadastro sem funil/utm: registro "Lead voltou pelo funil (sem funil)".
- Retorno de lead sem motivo de perda gravado: o trecho "motivo de perda anterior" não aparece.
- Retornos anteriores à mudança (129 touches): não mudam estágio nem ganham selo.

### Cenário de Erro
- Falha no trigger: o insert do novo cadastro falha como um todo (transação), e o webhook responde erro; nada fica pela metade.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-22 | automática | `src/test/integration/lead-return.integration.test.ts` | novo cadastro de lead em Desqualificado, Proposta Recusada, Nutrição ou Follow-up Futuro não cria lead, muda o estágio para Leads de Entrada, zera motivo de perda e próximo contato, mantém o responsável e guarda o motivo anterior no registro |
| CA-S1-23 | automática | `src/test/integration/lead-return.integration.test.ts` | lead nos estágios de trabalho ou Contrato Assinado mantém o estágio e o próximo contato |
| CA-S1-24 | automática | `src/test/integration/lead-return.integration.test.ts` | registro "Lead voltou pelo funil … (utm_source / utm_campaign)" assinado por "Sistema", além do touch de retorno |
| CA-S1-25 | automática | `src/lib/lead-return.test.ts` | selo "Voltou" por 7 dias a partir do retorno e some depois; a lista "Voltaram" traz só quem está no período, mais recente primeiro |
| CA-S1-26 | automática | `src/test/integration/lead-return.integration.test.ts` | todo lead marcado tem registro "Lead voltou"; retornos históricos (touches antigos) não marcaram o lead |

## Banco de Dados

- Tabela `leads`: `last_return_at` (timestamptz, nulo), com índice parcial.
- Tabela `activities`: CHECK de `type` inclui `lead_voltou`.
- Função `lead_return_reopens(status)`: estágios que reabrem (desqualificado, proposta_recusada, nutricao, follow_futuro).
- Função `fn_leads_dedup` (trigger BEFORE INSERT em `leads`): após o touch de retorno, reabre quando cabe, marca `last_return_at` e insere a atividade.

## Arquivos

- **Criar:** `supabase/migrations/20261101170000_lead_return.sql`
- **Criar:** `src/lib/lead-return.ts`: `RETURN_HIGHLIGHT_DAYS`, `hasRecentReturn`, `recentReturns`, `returnCutoffIso`.
- **Criar:** `src/lib/lead-return.test.ts`
- **Criar:** `src/test/integration/lead-return.integration.test.ts`
- **Modificar:** `src/components/pipeline/LeadActivities.tsx`: ícone e rótulo do tipo `lead_voltou`.
- **Modificar:** `src/pages/PipelinePage.tsx`: selo "Voltou" no card.
- **Modificar:** `src/pages/LeadsPage.tsx`: selo "Voltou" junto ao nome.
- **Modificar:** `src/pages/HojePage.tsx`: seção "Voltaram".
- **Modificar:** `src/integrations/supabase/types.ts`: regenerado (nova coluna e função).

## Dependências Externas

Nenhuma nova.

## Checklist

- [x] Migration aplicada e tipos regenerados
- [x] `lead-return.ts` + testes
- [x] Selo "Voltou" no card e na tabela; tipo na linha do tempo
- [x] Seção "Voltaram" em Hoje
- [x] Integração rodada contra produção com limpeza conferida
