# S2-02: Recebimento de mensagens (webhook, conversa por lead, mídia)

**Tipo:** Implementação
**Página:** Backend (webhook) + banco
**Spec:** `spec-chat-whatsapp.md`
**Referência de porte:** `docs/referencia/porte-whatsapp-crm-exponencial.md`

## Descrição

Criar conversas e mensagens no banco e processar o webhook da Meta: assinatura, filtro pelo número configurado, idempotência, lead conhecido ou novo (funil "whatsapp"), tipos de mensagem, mídia em bucket privado, status de entrega e janela de 24h.

## Pronto quando

Um evento assinado da Meta com mensagem de um lead conhecido aparece como mensagem recebida na conversa dele (consultável no banco), um de telefone novo cria o lead com a conversa, mídia fica no bucket privado, repetição não duplica, outro número e assinatura inválida são ignorados.

## Critérios de aceite

- **CA-S2-07** (automática) — Mensagem de lead conhecido entra na conversa dele. Dado um lead com WhatsApp cadastrado, quando a Meta entrega uma mensagem de texto desse telefone, então a conversa do lead ganha a mensagem com direção "recebida", texto e horário da Meta, e a contagem de não lidas sobe.
- **CA-S2-08** (automática) — Telefone desconhecido vira lead novo com conversa. Dado um telefone sem lead correspondente, quando chega a primeira mensagem, então existe um lead novo em Leads de Entrada com funil "whatsapp", nome igual ao perfil do WhatsApp (ou o número), e a conversa dele contém a mensagem.
- **CA-S2-09** (automática) — Mídia recebida fica guardada e privada. Dado uma mensagem com imagem, PDF ou áudio, quando ela é processada, então o arquivo está no armazenamento privado do CRM, ligado à mensagem, e não abre sem login.
- **CA-S2-10** (automática) — Entrega repetida não duplica. Dado uma mensagem já registrada, quando a Meta entrega o mesmo evento de novo, então a conversa continua com uma única cópia.
- **CA-S2-11** (automática) — Evento de outro número é ignorado. Dado a configuração apontando para o número A, quando chega um evento do número B pela mesma conta, então nada é gravado e o CRM responde sucesso à Meta.
- **CA-S2-12** (automática) — Assinatura inválida é recusada. Dado um evento cuja assinatura não confere com o segredo do app, quando ele chega, então é recusado e nada é gravado.
- **CA-S2-13** (automática) — Janela de 24 horas acompanha a última mensagem recebida. Dado uma conversa sem mensagem recebida há mais de 24 horas, quando o lead envia uma nova mensagem, então a conversa passa a mostrar a janela aberta, com o horário em que ela fecha.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-02 | A janela de 24 horas é contada a partir da última mensagem recebida do lead registrada no CRM; sem mensagem recebida, está fechada. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-04 | Mídia recebida é guardada no armazenamento privado do CRM com o mesmo padrão dos anexos (bucket próprio, só autenticados); limite de 16 MB por arquivo (limite da Meta). | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-06 | O tempo real usa o Realtime do Supabase sobre as tabelas de conversa e mensagem, visível a todos os usuários autenticados (mesma decisão de RLS compartilhado). | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-07 | Enquanto o número de teste estiver também no CRM externo, as mensagens enviadas de lá não aparecem aqui e vice-versa; só o que passa por este CRM é registrado. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-08 | Provas que dependem da Meta (envio real, status, templates) rodam contra o número de teste com um telefone do time como destinatário, em testes marcados para execução manual pelo desenvolvedor; o resto (webhook, janela, dedup, caixa de entrada) é provado com payloads gravados contra o banco de produção, como na S1. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-01 | Telefone desconhecido que manda mensagem: criar lead automaticamente em Leads de Entrada com funil "whatsapp" (proposto), ou guardar a conversa numa fila "sem lead" para alguém vincular manualmente? | respondida | Criar lead automaticamente em Leads de Entrada com funil "whatsapp". Marcelle, 2026-11-01. |

## Cenários

### Happy Path
1. A Meta faz POST no `whatsapp-webhook`. A função valida `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET` sobre o corpo bruto, responde 200 e processa em segundo plano (`EdgeRuntime.waitUntil`).
2. Lê a configuração; se inativa ou sem número, ignora. `parseWebhook` aceita só eventos do `phone_number_id` configurado.
3. Para cada mensagem, `whatsapp_ingest_message` (uma transação): ignora wamid repetido; acha o lead por `whatsapp_norm` ou cria em Leads de Entrada com funil "whatsapp" e nome do perfil; cria a conversa do lead se não houver; grava a mensagem; soma não lida, atualiza última mensagem e `last_inbound_at`.
4. Com mídia, baixa da Meta (`GET /{media_id}` → URL temporária) com o token do Vault e guarda em `whatsapp-media/{lead}/{wamid}.{ext}`; marca `media_status`.
5. Status (`sent/delivered/read/failed`) passam por `whatsapp_apply_status`, que só avança e grava o motivo traduzido da falha.

### Edge Cases
- Reação: atualiza `reaction_emoji` da mensagem alvo, sem criar mensagem nem somar não lida.
- Tipo não suportado: grava como "desconhecido" sem somar não lida.
- Mídia acima de 16 MB: `grande_demais`, sem download. Sem token: `falhou`.
- Duas mensagens simultâneas de telefone novo: a deduplicação serializa; a segunda encontra o lead criado pela primeira.
- Mensagem antiga entregue depois de uma nova: não sobrescreve a "última mensagem" da conversa.

### Cenário de Erro
- Assinatura ausente ou inválida: 401, nada gravado. JSON inválido: 400.
- Erro ao gravar uma mensagem: registrado no log da função; as demais do mesmo pacote seguem.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-07 | automática | `src/test/whatsapp-inbound.test.ts` + `src/test/integration/whatsapp-inbound.integration.test.ts` | o payload vira mensagem recebida com texto, perfil e horário da Meta; no banco, a conversa do lead conhecido ganha a mensagem e as não lidas sobem a cada nova |
| CA-S2-08 | automática | `src/test/integration/whatsapp-inbound.integration.test.ts` | telefone desconhecido cria lead em Leads de Entrada, funil whatsapp, nome do perfil (ou o número) e a conversa com a mensagem |
| CA-S2-09 | automática | `src/test/whatsapp-inbound.test.ts` + `src/test/integration/whatsapp-inbound.integration.test.ts` | a mídia é buscada com o token e enviada ao armazenamento (limite de 16 MB respeitado); no banco a mensagem fica pendente de mídia e o bucket nega acesso sem login e libera com login |
| CA-S2-10 | automática | `src/test/integration/whatsapp-inbound.integration.test.ts` | o mesmo wamid duas vezes resulta em uma mensagem e uma não lida |
| CA-S2-11 | automática | `src/test/whatsapp-inbound.test.ts` | eventos de outro número ou sem número configurado não geram mensagem |
| CA-S2-12 | automática | `src/test/whatsapp-inbound.test.ts` + `src/test/integration/whatsapp-inbound.integration.test.ts` | assinatura errada, ausente ou de corpo alterado é recusada; o webhook publicado responde 401 e nada é gravado |
| CA-S2-13 | automática | `src/test/whatsapp-inbound.test.ts` + `src/test/integration/whatsapp-inbound.integration.test.ts` | janela fechada sem mensagem há 24h; nova mensagem recebida abre e informa o horário de fechamento |

## Banco de Dados

- `whatsapp_conversations`: `lead_id` único (cascade), `unread_count`, `last_message_at/text/direction`, `last_inbound_at`. RLS: autenticados leem.
- `whatsapp_messages`: conversa, lead, `direction`, `type` (CHECK), `content`, mídia (`media_meta_id`, `media_path`, `media_mime`, `media_filename`, `media_size`, `media_status`), `status`/`status_error`, `wamid` único, `reply_to_wamid`, `reaction_emoji`, `sent_by`/`sent_by_email`, `phone_number_id`, `read_at`, `created_at`. RLS: autenticados leem.
- Ambas na publicação `supabase_realtime`.
- Funções `whatsapp_status_rank`, `whatsapp_ingest_message`, `whatsapp_apply_status` (as duas últimas só service role).
- Bucket privado `whatsapp-media` (16 MB), leitura e envio só para autenticados.
- Segredos: `WHATSAPP_APP_SECRET` (provisório até o app da Meta existir) e `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, ambos também no `.env` local.

## Arquivos

- **Criar:** `supabase/migrations/20261101210000_whatsapp_conversations.sql`
- **Criar:** `supabase/functions/_shared/whatsapp-inbound.ts`: assinatura, leitura do payload, tipos.
- **Criar:** `supabase/functions/_shared/whatsapp-window.ts`: janela de 24h.
- **Criar:** `supabase/functions/_shared/whatsapp-errors.ts`: tradução dos erros da Meta.
- **Criar:** `supabase/functions/_shared/whatsapp-media.ts`: download e guarda da mídia.
- **Criar:** `src/test/whatsapp-inbound.test.ts`
- **Criar:** `src/test/integration/whatsapp-inbound.integration.test.ts`
- **Modificar:** `supabase/functions/whatsapp-webhook/index.ts`: fase 2 (processamento) com o segredo do app interno.
- **Modificar:** `src/integrations/supabase/types.ts`: regenerado.

## Dependências Externas

- Graph API v26.0: `GET /{media_id}` e download da URL temporária da mídia.

## Checklist

- [x] Migration aplicada (tabelas, funções, Realtime, bucket) e tipos regenerados
- [x] Módulos de recebimento, janela, erros e mídia + testes
- [x] Webhook com assinatura do app interno, resposta imediata e processamento em segundo plano
- [x] Segredos do webhook definidos (provisório) e anotados no `.env`
- [x] Integração e ponta a ponta rodados contra produção com limpeza conferida
