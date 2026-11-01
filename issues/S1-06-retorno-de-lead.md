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
