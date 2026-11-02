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
