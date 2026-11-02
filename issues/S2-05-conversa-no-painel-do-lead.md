# S2-05: Conversa no painel do lead

**Tipo:** Implementação
**Página:** Painel do lead › aba Conversa
**Spec:** `spec-chat-whatsapp.md`
**Referência de porte:** `docs/referencia/porte-whatsapp-crm-exponencial.md`

## Descrição

Aba "Conversa" no painel do lead com histórico em tempo real agrupado por dia, balões por tipo e status, indicador de janela, caixa de envio (texto, anexo, template), zerar não lidas e enviar o "visto" ao abrir.

## Pronto quando

Abrir um lead com conversa mostra as mensagens por dia, a janela aberta/fechada, e mensagens novas chegam sem recarregar; abrir zera as não lidas; lead sem conversa só oferece template.

## Critérios de aceite

- **CA-S2-21** (automática) — Abrir a conversa zera não lidas. Dado uma conversa com 3 não lidas, quando o usuário abre a aba Conversa, então a contagem vai a zero e as mensagens recebidas ficam marcadas como lidas no CRM.
- **CA-S2-22** (automática) — Tempo real na conversa. Dado a aba Conversa aberta, quando uma mensagem nova é gravada para aquele lead, então ela aparece na lista em menos de 3 segundos, sem recarregar a página.
- **CA-S2-23** (automática) — Lead sem conversa exige template na primeira mensagem. Dado um lead sem nenhuma mensagem, quando o usuário abre a aba Conversa, então a caixa de texto livre está desabilitada e o seletor de template está disponível.
- **CA-S2-24** (manual) — Exibição por tipo de mensagem. Dado uma conversa com texto, imagem, PDF, áudio, figurinha e localização, quando o usuário a abre, então cada tipo aparece do jeito descrito nos componentes, agrupado por dia, com status e autor nas enviadas.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-05 | Abrir a conversa envia confirmação de leitura à Meta (o lead vê o "visto"). | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-06 | O tempo real usa o Realtime do Supabase sobre as tabelas de conversa e mensagem, visível a todos os usuários autenticados (mesma decisão de RLS compartilhado). | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.

## Cenários

### Happy Path
1. O painel do lead ganha as abas "Dados" (tudo o que já existia) e "Conversa", com contador de não lidas.
2. A aba Conversa carrega a conversa e as mensagens do lead, assina o Realtime (`whatsapp_messages` e `whatsapp_conversations` filtrados pelo lead) e gera links assinados de mídia.
3. Mensagens aparecem agrupadas por dia (Hoje, Ontem, data), balões por direção, autor e status nas enviadas, imagem com ampliação, áudio com player, PDF como link.
4. Indicador "Janela: Aberta até HH:mm" ou "Fechada: envie um template", atualizado a cada minuto.
5. Abrir a aba (ou chegar mensagem com ela aberta) chama `whatsapp-mark-read`: zera não lidas, marca as recebidas como lidas e envia o "visto" à Meta.
6. A caixa de envio manda texto (Enter), anexo JPG/PNG/PDF (sobe para `whatsapp-media/{lead}/out/` e chama o envio) ou template.

### Edge Cases
- Lead sem conversa: aviso de que a primeira mensagem precisa ser template; só o seletor de template.
- Janela fecha com a aba aberta: o indicador e a caixa mudam no minuto seguinte.
- Mídia pendente, grande demais ou com falha: texto explicativo no balão.
- Reação: emoji sobre o balão alvo.

### Cenário de Erro
- Falha no envio: toast com o motivo; o balão (se gravado) aparece como "falhou" com o motivo.
- Falha no upload do anexo: toast, nada é enviado.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-21 | automática | `src/test/integration/whatsapp-conversation.integration.test.ts` | com 3 não lidas, a função publicada zera a contagem e marca as recebidas como lidas |
| CA-S2-22 | automática | `src/test/integration/whatsapp-conversation.integration.test.ts` + `src/test/whatsapp-chat.test.tsx` | um usuário logado assinando a conversa do lead recebe a mensagem nova em menos de 3 s; a lista acrescenta a nova e atualiza status sem duplicar |
| CA-S2-23 | automática | `src/test/whatsapp-chat.test.tsx` | sem conversa ou janela fechada a caixa de texto livre não existe e o seletor de template aparece; com janela aberta, a caixa está habilitada |
| CA-S2-24 | manual | roteiro abaixo | exibição de cada tipo agrupada por dia, com status e autor |

### Roteiro manual — CA-S2-24
1. Com o número conectado, mande do celular para o número do CRM: um texto, uma imagem, um PDF, um áudio, uma figurinha e uma localização.
2. Abra o lead (criado ou existente) e a aba Conversa.
3. Confira: separador de dia; texto; imagem em miniatura que amplia ao clicar; PDF como link com o nome; áudio com player; figurinha pequena; localização com link do mapa.
4. Responda com um texto: o balão aparece à direita com seu nome, horário e o ícone de status (✓, ✓✓, ✓✓ azul quando lido no celular).

## Banco de Dados

Sem mudança de schema.

## Arquivos

- **Criar:** `supabase/functions/whatsapp-mark-read/index.ts`: zera não lidas, marca lidas e envia o "visto".
- **Criar:** `src/lib/whatsapp-chat.ts`: agrupamento por dia, janela, modo da caixa, status, validação de anexo de saída.
- **Criar:** `src/hooks/useLeadConversation.ts`: carga, Realtime, links assinados e marcar como lida.
- **Criar:** `src/components/whatsapp/Composer.tsx`: caixa de envio (texto, anexo, template).
- **Criar:** `src/components/whatsapp/LeadConversation.tsx`: aba Conversa.
- **Criar:** `src/test/whatsapp-chat.test.tsx`
- **Criar:** `src/test/integration/whatsapp-conversation.integration.test.ts`
- **Modificar:** `src/components/pipeline/LeadDetailPanel.tsx`: abas Dados/Conversa, contador, aba inicial por prop.
- **Modificar:** `src/test/setup.ts`: só configura `matchMedia` quando há DOM (integração com Realtime roda em ambiente node).
- **Modificar:** `supabase/config.toml`: `whatsapp-mark-read`.

## Dependências Externas

- Supabase Realtime (`postgres_changes`), Graph API v26.0 (`status: read`).

## Checklist

- [x] Função `whatsapp-mark-read` deployada
- [x] Hook com Realtime e mídia assinada
- [x] Aba Conversa com dias, balões, mídia, janela e caixa de envio
- [x] Abas no painel do lead com contador de não lidas
- [x] Testes de exibição e integração (zerar não lidas, tempo real)
