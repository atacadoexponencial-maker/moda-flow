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
