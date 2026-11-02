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
