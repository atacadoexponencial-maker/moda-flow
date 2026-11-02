# S2-06: Caixa de entrada "Conversas"

**Tipo:** Implementação
**Página:** Conversas (menu lateral)
**Spec:** `spec-chat-whatsapp.md`
**Referência de porte:** `docs/referencia/porte-whatsapp-crm-exponencial.md`

## Descrição

Página "Conversas" no menu com total de não lidas: lista ordenada pela última mensagem, filtros Minhas/Sem responsável/Todas e Não respondidas, busca, Assumir, tempo real; clique abre o painel na aba Conversa.

## Pronto quando

Abrir Conversas mostra as conversas da mais recente para a mais antiga com não lidas; filtros funcionam; mensagem nova sobe a conversa ao topo sem recarregar; o menu mostra o total de não lidas.

## Critérios de aceite

- **CA-S2-25** (automática) — Ordenação e não lidas. Dado conversas com mensagens em horários diferentes, quando o usuário abre a caixa de entrada, então a lista vem da mais recente para a mais antiga, com a contagem de não lidas de cada uma e o total no menu.
- **CA-S2-26** (automática) — Filtro "Não respondidas". Dado conversas em que a última mensagem é do lead e outras em que é do time, quando o usuário ativa "Não respondidas", então só as primeiras aparecem.
- **CA-S2-27** (automática) — Filtros por responsável. Dado conversas de leads com responsáveis variados, quando o usuário escolhe "Minhas" ou "Sem responsável", então a lista obedece à mesma regra do filtro de responsável do Pipeline.
- **CA-S2-28** (automática) — Tempo real na caixa de entrada. Dado a caixa de entrada aberta, quando chega uma mensagem de um lead, então a conversa dele vai para o topo com a contagem atualizada em menos de 3 segundos.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-06 | O tempo real usa o Realtime do Supabase sobre as tabelas de conversa e mensagem, visível a todos os usuários autenticados (mesma decisão de RLS compartilhado). | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-03 | O menu "Conversas" entra como item principal da barra lateral (junto de Pipeline, Leads, Hoje) ou dentro de Hoje? | respondida | Item principal na barra lateral, com total de não lidas. Marcelle, 2026-11-01. |
