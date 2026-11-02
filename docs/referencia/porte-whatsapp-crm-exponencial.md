# Guia de porte: WhatsApp Cloud API (crm-exponencial → moda-flow)

> Levantamento feito em 2026-11-01 sobre `C:\Users\marce\OneDrive\Estudo\crm-exponencial`,
> para orientar o `/plan` das issues da série S2 (`spec-chat-whatsapp.md`). É referência,
> não especificação. Caminhos abaixo são relativos à raiz daquele repositório.
> Graph API em **v26.0** (`src/lib/whatsapp/versao-da-graph.ts`).

## Resumo do que vale e do que não vale copiar

- **Vale:** provider da Meta (`provider-meta.ts`), parse do payload (`mensagem-meta.ts`),
  download de mídia (`midia-recebida.ts`, sem a parte de ffmpeg), tradução de erros
  (`motivo-da-falha.ts`), templates (`templates-da-meta*.ts`), padrão de status que só
  avança, HMAC do webhook, chamadas de teste e inscrição da WABA.
- **Não existe lá:** janela de 24h, seletor de template no chat, configuração manual sem
  Embedded Signup, tabela de idempotência do webhook da Meta, agrupamento por dia.
- **Defeitos a não copiar:** reação/unsupported/system viram texto vazio e contam não lida;
  nota interna não grava; "responder" não envia `context`; falta índice em
  `messages(conversation_id)`; listagem de templates não pagina; token em query string.

## 1. Schema (adaptar para "um número, uma conversa por lead")

**conversations** (`20260501000001`, `20260919000000`): id, contact_id (→ aqui `lead_id`,
único por lead), status (`em_espera|em_atendimento|resolvida`, sem CHECK), assigned_to,
unread_count, last_message_text, last_message_at, whatsapp_connection_id. Criar índices
`(last_message_at desc)` e `(lead_id)`. Acrescentar `last_inbound_at` para a janela de 24h.

**messages** (`20260503000000` + colunas em `20260519000000`, `20260917000011/12`,
`20261019000001`, `20261020000005`): conversation_id, direction (`enviada|recebida`), type
(`texto|imagem|video|audio|documento|figurinha|localizacao|contato|desconhecido`), content,
status (`null|na_fila|enviado|entregue|lido|falhou`), status_error, reply_to_id,
reply_preview_text, wamid UNIQUE, media_mime_type, media_filename, media_caption,
media_thumbnail_url, reaction_emoji, edited_at, deleted_at, created_at. Criar índice
`(conversation_id, created_at)`. Realtime: tabela na publicação com `replica identity full`.

**whatsapp_connections**: no moda-flow já existe `whatsapp_config` (linha única, token no
Vault). Manter: `waba_id`, `phone_number_id`, `display_phone_number`, `verified_name`,
`ativo`, `vault_secret_id`.

**Idempotência do webhook:** o gateway usa `gateway_events(event_id, processed_at)`
(`20260917000010`). Replicar como `whatsapp_webhook_events` com chave = wamid (mensagens)
ou `wamid+status` (status).

**Buckets:** `chat-attachments` privado (`20261029000001`). Aqui: bucket próprio privado,
mesmo padrão de `activity-attachments`.

## 2. Recebimento (webhook `src/app/api/webhooks/whatsapp/route.ts`)

- GET: `hub.mode=subscribe` e `hub.verify_token`; responde `hub.challenge` em texto puro.
- POST: lê corpo bruto, valida `X-Hub-Signature-256` (HMAC-SHA256 hex do corpo com o app
  secret, comparação em tempo constante). Sem segredo configurado → 401.
- Filtra por `metadata.phone_number_id`; busca a conexão por ele; desconhecido → ignora.
- Dedup: `select id from messages where wamid = …` + unique.
- Parse (`mensagem-meta.ts`): `text.body`; `button.text`; `interactive.button_reply.title`
  ou `list_reply.title`; image/video/document (legenda em `media_caption`); `contacts`
  vira cartão em texto; `location` vira nome, endereço e link do Maps. Mídia:
  `midiaDaMensagemMeta` devolve `{id, mime_type, filename, caption}` para image, video,
  audio, document, sticker.
- Tratar no porte: `reaction` → atualizar `reaction_emoji` da mensagem alvo;
  `context.id` → `reply_to_id`; `unsupported`/`system` → tipo `desconhecido` sem contar
  não lida; `errors[]` em statuses → `status_error` com código e título.
- `created_at` = `Number(message.timestamp) * 1000`.
- Contato: busca por telefone normalizado; cria se não existir (aqui: insert em `leads`
  com funil `whatsapp`; o trigger de dedup decide novo vs retorno).
- Conversa: uma por lead; se resolvida, reabre. `unread_count + 1` deve ser atômico
  (`update … set unread_count = unread_count + 1`).
- Status (`route.ts:34-56`): `delivered→entregue`, `read→lido`, `failed→falhou`; `sent`
  ignorado (nasce `enviado`). Só avança: `entregue` não sobrescreve `lido`; `falhou` não
  sobrescreve `entregue`/`lido`.
- Mídia (`midia-recebida.ts`): `GET {GRAPH}/{media_id}` → `{url, mime_type}` (URL vale 5
  min) → baixa com o mesmo Bearer → upload no bucket privado em
  `{lead_id}/{conversa}/{ts}-{uuid}.{ext}`; lista branca MIME→extensão; limite 16 MB
  (Meta). Sem miniatura (a Meta não manda). Conversão de vídeo HEVC usa ffmpeg: **não
  roda em Edge Function**; mostrar "Baixar original".
- Foto de perfil: a Cloud API não fornece. Usar iniciais.
- O webhook lá processa tudo antes de responder. No porte: validar HMAC → gravar evento →
  responder 200 → processar em `EdgeRuntime.waitUntil`.

## 3. Envio (`src/lib/whatsapp/provider-meta.ts`, `chat/actions.ts`)

- Endpoint único: `POST {GRAPH}/{phone_number_id}/messages`, `Authorization: Bearer`.
- Texto: `{"messaging_product":"whatsapp","to":"55…","type":"text","text":{"body":"…"}}`.
- Mídia: `type` em `image|video|audio|document`, `[type]: {link, caption?, filename?}`;
  `filename` só em document; `link` é URL assinada do Storage (1 h).
- Template: `{"type":"template","template":{"name","language":{"code":"pt_BR"},
  "components":[{"type":"body","parameters":[{"type":"text","text":"…"}]}, header texto
  ou mídia, botão url com `sub_type`/`index`]}}`.
- Marcar como lida: `{"messaging_product":"whatsapp","status":"read","message_id":"wamid"}`
  com o wamid da última recebida; nunca lança erro.
- Resposta OK: `messages[0].id` é o wamid. Não-2xx: `{ok:false, motivo}`.
- Fluxo do chat: validar → upload → link assinado → enviar → **só se a Meta aceitar**
  inserir mensagem `enviado` com wamid → atualizar `last_message_*` da conversa. Falha de
  texto é gravada como `falhou` com `status_error`.
- Erros (`motivo-da-falha.ts`): 131047 janela fechada (abrir seletor de template);
  131026 destinatário não recebe; 131049 limite de marketing; 131051 tipo não suportado;
  132000 nº de variáveis; 132001 template inexistente/não aprovado; 132012 valor de
  variável inválido (sem `\n\t` nem 4+ espaços); 132015 pausado; 132016 desativado;
  **130429 rate limit** não está mapeado lá (mapear; sem retry).

## 4. Templates (`templates-da-meta*.ts`, `configuracoes/templates/actions.ts`)

- Listar: `GET {GRAPH}/{waba_id}/message_templates?fields=id,name,status,category,
  language,rejected_reason,components&limit=50` — **paginar por `paging.next`**.
- Componentes: `partesDoTemplate(components)` → `{cabecalho, corpo, rodape, botoes}`;
  `quantidadeDeVariaveis` conta `{{n}}`; `valoresDasVariaveis` aplica reserva e limpa
  caracteres proibidos. Reaproveitar os três.
- Status: APPROVED, PENDING, REJECTED, PAUSED; só APPROVED (e não AUTHENTICATION) no
  seletor de envio. Criar/editar/apagar ficam fora da S2.
- Prévia: `components/shared/previa-do-template.tsx` (Base UI → refazer em shadcn).

## 5. Tempo real

Modelo híbrido lá: `postgres_changes` em conversations/messages (UPDATE/INSERT) no canal
privado `workspace:{id}` + broadcast privado `nova_mensagem` com links de mídia já
assinados (emitido pelo backend via `POST {SUPABASE_URL}/realtime/v1/api/broadcast` com
service role, `private: true`). Cliente chama `supabase.realtime.setAuth(token)` antes de
`subscribe`. Para o moda-flow (RLS compartilhado, um workspace): basta `postgres_changes`
em `messages` e `conversations` para `authenticated`, com a mídia assinada na leitura.

## 6. UI do chat (`src/app/(auth)/chat/components/`)

- `chat-layout.tsx`: três colunas (lista, ficha, conversa); zera não lidas ao abrir e
  manda recibo de leitura.
- `filtros-caixa.tsx`: busca nome/telefone; Minhas/Meu time/Todas × status; etiquetas;
  paginação infinita (50, cursor `last_message_at`).
- `item-conversa.tsx`: avatar iniciais, ponto "sem dono", nome em negrito se não lidas,
  horário, prévia, badge de não lidas.
- `painel-conversa.tsx`: cabeçalho (nome, telefone, responsável, status), ações
  atribuir/transferir/resolver/reabrir, busca na conversa, envio otimista com id local,
  respostas rápidas, anexos até 4 MB, gravação de áudio em MP3 no navegador.
- `balao-mensagem.tsx`: ✓ enviado, ✓✓ entregue, ✓✓ azul lido, triângulo vermelho falhou
  com motivo; imagem com lightbox; player de áudio; documento com nome.
- Falta lá e entra aqui: separadores por dia, indicador de janela de 24h, seletor de
  template no chat, `reply_to_id` de verdade.

## 7. Configuração manual (não existe lá; reaproveitar as chamadas)

`configuracoes/whatsapp/actions.ts:551-669` (Embedded Signup):
- Testar: `GET {GRAPH}/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating`.
- Registrar (se necessário): `POST {GRAPH}/{phone_number_id}/register` `{"messaging_product":"whatsapp","pin":"000000"}`.
- Inscrever o app na WABA: `POST {GRAPH}/{waba_id}/subscribed_apps` com Bearer, sem corpo.
- Reinscrever webhook: mesmo POST.
No moda-flow: formulário admin (waba_id, phone_number_id, token) → Edge Function testa →
inscreve → grava `whatsapp_config` com token no Vault. Segredos do app interno:
`WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET` (HMAC), `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

## 8. Trocas Node → Deno

`node:crypto` HMAC → `crypto.subtle`; `after()` → `EdgeRuntime.waitUntil`; ffmpeg/fs/os →
fora; `Buffer` → `Uint8Array`; `process.env` → `Deno.env.get`; `fetch`, `AbortSignal.timeout`,
`crypto.randomUUID` iguais. Cuidado com memória e tempo da Edge Function no download de mídia.
