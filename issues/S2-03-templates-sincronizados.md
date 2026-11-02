# S2-03: Templates sincronizados da Meta

**Tipo:** Implementação
**Página:** Configurações › WhatsApp › Templates
**Spec:** `spec-chat-whatsapp.md`
**Referência de porte:** `docs/referencia/porte-whatsapp-crm-exponencial.md`

## Descrição

Sincronizar os templates da conta (com paginação) para o CRM, listar com status e prévia, e oferecer no envio só os aprovados com campos de variáveis e prévia do texto final.

## Pronto quando

Clicar em Sincronizar traz os templates da conta com nome, idioma, categoria e status; o componente de seleção mostra só os aprovados e só habilita com todas as variáveis preenchidas, exibindo a prévia.

## Critérios de aceite

- **CA-S2-29** (automática) — Sincronizar templates. Dado templates na conta da Meta, quando o admin sincroniza, então a lista do CRM mostra nome, idioma, categoria e status iguais aos da Meta.
- **CA-S2-30** (automática) — Só aprovados no seletor de envio. Dado templates aprovados, pendentes e reprovados, quando o usuário abre o seletor no envio, então vê só os aprovados.
- **CA-S2-31** (automática) — Prévia com variáveis preenchidas. Dado um template com duas variáveis, quando o usuário preenche "Ana" e "quarta-feira", então a prévia mostra o texto do template com os valores no lugar dos marcadores, e o envio só habilita com todas preenchidas.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-01 | O CRM interno usa um app Meta próprio, no mesmo portfólio verificado, com segredos separados dos do Meta Ads (`WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`); o token é de usuário de sistema, permanente. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-08 | Provas que dependem da Meta (envio real, status, templates) rodam contra o número de teste com um telefone do time como destinatário, em testes marcados para execução manual pelo desenvolvedor; o resto (webhook, janela, dedup, caixa de entrada) é provado com payloads gravados contra o banco de produção, como na S1. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
