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

## Cenários

### Happy Path
1. Item "Conversas" na barra lateral, entre Hoje e Dashboard, com o total de não lidas (ponto quando a barra está recolhida).
2. A página lista as conversas com mensagem, da mais recente para a mais antiga: iniciais, nome em negrito se há não lidas, estágio do lead, trecho da última mensagem ("Você:" quando foi do time), horário, responsável (iniciais) ou "Assumir", contador de não lidas.
3. Filtros: Minhas / Sem responsável / Todas (mesma regra do Pipeline), "Não respondidas" (última mensagem do lead) e busca por nome ou telefone.
4. Clicar abre o painel do lead direto na aba Conversa.
5. Tempo real: mudança em `whatsapp_conversations` atualiza a linha e reordena; conversa nova recarrega a lista com os dados do lead.

### Edge Cases
- Sem conversas ou filtro vazio: mensagem "Nenhuma conversa com esses filtros".
- "Minhas" sem usuário logado: vazio.
- Barra lateral e página abertas juntas: canais de tempo real com nomes distintos.

### Cenário de Erro
- Lead apagado entre a lista e o clique: toast "Lead não encontrado".
- Falha ao assumir: toast de erro.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-25 | automática | `src/test/whatsapp-inbox.test.ts` | ordem da mais recente para a mais antiga, contagem por conversa e total para o menu |
| CA-S2-26 | automática | `src/test/whatsapp-inbox.test.ts` | "Não respondidas" mantém só conversas com última mensagem do lead |
| CA-S2-27 | automática | `src/test/whatsapp-inbox.test.ts` | Minhas e Sem responsável usam `applyAssigneeFilter`, com os mesmos resultados do Pipeline |
| CA-S2-28 | automática | `src/test/integration/whatsapp-inbox.integration.test.ts` + `src/test/whatsapp-inbox.test.ts` | usuário logado recebe a atualização da conversa em menos de 3 s com não lidas = 2; a lista leva a conversa ao topo mantendo os dados do lead |

## Banco de Dados

Sem mudança de schema.

## Arquivos

- **Criar:** `src/lib/whatsapp-inbox.ts`: ordenação, total, não respondidas, filtros e aplicação do tempo real.
- **Criar:** `src/hooks/useWhatsAppInbox.ts`: lista com dados do lead e Realtime.
- **Criar:** `src/pages/ConversasPage.tsx`
- **Criar:** `src/test/whatsapp-inbox.test.ts`
- **Criar:** `src/test/integration/whatsapp-inbox.integration.test.ts`
- **Modificar:** `src/components/AppSidebar.tsx`: item Conversas com contador.
- **Modificar:** `src/App.tsx`: rota `/conversas`.

## Dependências Externas

- Supabase Realtime (`postgres_changes` em `whatsapp_conversations`).

## Checklist

- [x] Regras da caixa de entrada + testes
- [x] Hook com tempo real (canal único por instância)
- [x] Página Conversas com filtros, busca, Assumir e abertura na aba Conversa
- [x] Item na barra lateral com total de não lidas
- [x] Integração de tempo real rodada contra produção
