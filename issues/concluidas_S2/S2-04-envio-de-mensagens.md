# S2-04: Envio de mensagens (texto, mídia, template e status)

**Tipo:** Implementação
**Página:** Backend (envio) + banco
**Spec:** `spec-chat-whatsapp.md`
**Referência de porte:** `docs/referencia/porte-whatsapp-crm-exponencial.md`

## Descrição

Edge Function de envio autenticada: texto e imagem/PDF dentro da janela, template fora dela, grava wamid/autor/status, atualiza último contato, traduz recusas da Meta; status entregue/lido só avançam.

## Pronto quando

Chamar o envio com texto numa conversa com janela aberta grava a mensagem enviada com wamid e autor; com janela fechada é recusado; template com variáveis é aceito; status da Meta atualiza sem regredir; recusa vira "falhou" com motivo em português.

## Critérios de aceite

- **CA-S2-14** (automática) — Envio de texto dentro da janela. Dado uma conversa com janela aberta, quando o usuário envia um texto, então a mensagem é gravada como "enviada" com o identificador da Meta, o autor e o horário, e o lead tem o último contato atualizado para hoje.
- **CA-S2-15** (automática) — Envio de imagem ou PDF. Dado uma conversa com janela aberta, quando o usuário anexa uma imagem ou PDF e envia, então o arquivo fica no armazenamento privado ligado à mensagem e a mensagem é aceita pela Meta.
- **CA-S2-16** (automática) — Janela fechada bloqueia texto livre. Dado uma conversa sem mensagem recebida nas últimas 24 horas, quando o usuário tenta enviar texto livre, então o envio é recusado pelo servidor e a tela mostra o seletor de template no lugar da caixa de texto.
- **CA-S2-17** (automática) — Envio de template com variáveis. Dado um template aprovado com variáveis, quando o usuário preenche as variáveis e envia, então a mensagem é aceita pela Meta e o balão mostra o texto final com as variáveis substituídas.
- **CA-S2-18** (automática) — Status entregue e lido atualizam o balão. Dado uma mensagem enviada, quando a Meta informa entregue e depois lido, então o status da mensagem passa por entregue e lido, nessa ordem, e nunca regride.
- **CA-S2-19** (automática) — Recusa da Meta vira "falhou" com motivo. Dado um envio que a Meta recusa, quando a recusa chega (na resposta ou por status), então a mensagem fica como "falhou" com o motivo em linguagem simples (ex.: "Janela de 24 horas fechada. Envie um template.").
- **CA-S2-20** (automática) — Quem não está logado não envia. Dado uma chamada de envio sem usuário autenticado, quando ela chega ao servidor, então é recusada e nada é enviado.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-02 | A janela de 24 horas é contada a partir da última mensagem recebida do lead registrada no CRM; sem mensagem recebida, está fechada. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-03 | Mensagens recebidas e enviadas não viram atividades na linha do tempo (ficam só na conversa); enviar mensagem atualiza `data_ultimo_contato` do lead. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-08 | Provas que dependem da Meta (envio real, status, templates) rodam contra o número de teste com um telefone do time como destinatário, em testes marcados para execução manual pelo desenvolvedor; o resto (webhook, janela, dedup, caixa de entrada) é provado com payloads gravados contra o banco de produção, como na S1. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-02 | Qual telefone do time recebe as mensagens dos testes de envio real (destinatário dos testes manuais)? | respondida | Decidir na issue de envio; o número do destinatário é informado na hora do teste manual. Marcelle, 2026-11-01. |

## Cenários

### Happy Path
1. A tela chama `whatsapp-send` com o lead e o tipo (texto, mídia já enviada ao bucket `whatsapp-media`, ou template com valores).
2. A função exige login com papel; `sendMessage` valida, acha o lead e o telefone (com DDI), confere a janela (texto/mídia só com janela aberta), lê a conexão e o token.
3. Grava a mensagem como "enviando" com autor e número, chama `POST /{phone_number_id}/messages`; aceita → "enviado" com o wamid; atualiza a última mensagem da conversa e o último contato do lead.
4. Os status da Meta chegam pelo webhook e passam por `whatsapp_apply_status` (só avançam).

### Edge Cases
- Lead sem conversa: só template; a conversa é criada no primeiro envio.
- Imagem só JPG/PNG até 5 MB; PDF até 16 MB; legenda opcional.
- Template não aprovado, inexistente ou com variável vazia: recusado sem chamar a Meta.
- Telefone sem DDI (10/11 dígitos) ganha 55.

### Cenário de Erro
- Recusa da Meta (resposta): mensagem fica "falhou" com o motivo traduzido; último contato não muda.
- Falha por status (depois): "falhou" com motivo; nunca sobrescreve entregue/lido.
- Sem login: 401; sem papel: 403; sem número conectado: `sem_conexao`.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-14 | automática | `src/test/whatsapp-send.test.ts` | texto com janela aberta vira mensagem "enviado" com wamid, autor e horário, payload correto à Meta e último contato do lead = hoje |
| CA-S2-15 | automática | `src/test/whatsapp-send.test.ts` | imagem e PDF saem com link assinado do armazenamento privado e ficam ligados à mensagem; fora dos limites é recusado |
| CA-S2-16 | automática | `src/test/whatsapp-send.test.ts` + `src/test/integration/whatsapp-send.integration.test.ts` | janela fechada, sem mensagem recebida ou sem conversa: recusado sem chamar a Meta e sem gravar; no servidor publicado o mesmo |
| CA-S2-17 | automática | `src/test/whatsapp-send.test.ts` | template aprovado com variáveis sai com os componentes certos mesmo com janela fechada e o balão guarda o texto final; variável vazia ou template pendente é recusado |
| CA-S2-18 | automática | `src/test/integration/whatsapp-send.integration.test.ts` | entregue → lido nessa ordem; entregue atrasado e falha posterior não regridem |
| CA-S2-19 | automática | `src/test/whatsapp-send.test.ts` + `src/test/integration/whatsapp-send.integration.test.ts` | recusa da Meta (131047, 130429) vira "falhou" com motivo em português; falha por status idem |
| CA-S2-20 | automática | `src/test/integration/whatsapp-send.integration.test.ts` | sem login 401, sem papel 403, nada gravado |

## Banco de Dados

Sem mudança de schema (usa `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_templates`, `whatsapp_apply_status` e o bucket `whatsapp-media`).

## Arquivos

- **Criar:** `supabase/functions/_shared/whatsapp-send.ts`: validação, número, janela, payloads, envio à Meta e gravação via repositório.
- **Criar:** `supabase/functions/whatsapp-send/index.ts`
- **Criar:** `src/test/whatsapp-send.test.ts`
- **Criar:** `src/test/integration/whatsapp-send.integration.test.ts`
- **Modificar:** `supabase/config.toml`: `whatsapp-send` com verificação manual de JWT.

## Dependências Externas

- Graph API v26.0: `POST /{phone_number_id}/messages` (text, image, document, template).

## Checklist

- [x] Módulo de envio com janela, mídia, template e tradução de erros
- [x] Função `whatsapp-send` deployada com papel exigido
- [x] Testes de unidade (Meta simulada) e integração (servidor e status)
- [x] Envio real com Meta adiado para quando o app existir (fora da prova automática; ver PER-S2-02)
