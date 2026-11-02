# S2-01: Conexão manual do número (Configurações › WhatsApp)

**Tipo:** Implementação
**Página:** Configurações › WhatsApp
**Spec:** `spec-chat-whatsapp.md`
**Referência de porte:** `docs/referencia/porte-whatsapp-crm-exponencial.md`

## Descrição

Trocar o Embedded Signup por configuração manual: WABA, identificador do número e token de usuário de sistema; validar na Meta, assinar o app à WABA, guardar o token no Vault; testar, trocar número e desconectar, tudo só para proprietário/admin.

## Pronto quando

Na tela de WhatsApp, preencher os três campos e conectar mostra o cartão de estado com número, nome verificado e qualidade; token inválido mostra o erro da Meta e não altera nada; Testar e Desconectar funcionam; nenhum botão de login da Meta.

## Critérios de aceite

- **CA-S2-01** (automática) — Conectar número por configuração manual. Dado WABA, identificador do número e token válidos, quando o admin conecta, então a conexão fica ativa, o token não aparece em nenhuma resposta ao navegador (só a marca "token configurado"), e a conta fica assinada aos eventos de mensagens e status.
- **CA-S2-02** (automática) — Token inválido não é salvo. Dado um token inválido ou sem permissão de mensagens, quando o admin tenta conectar, então a tela mostra o erro devolvido pela Meta e a configuração anterior permanece como estava.
- **CA-S2-03** (automática) — Testar conexão mostra número e qualidade. Dado a conexão ativa, quando o admin clica em Testar conexão, então vê o número exibido, o nome verificado e a qualidade do número informados pela Meta.
- **CA-S2-04** (automática) — Trocar o número preserva o histórico. Dado conversas e mensagens registradas com o número A, quando o admin troca para o número B, então as conversas antigas continuam visíveis e as novas mensagens passam a sair e chegar pelo número B.
- **CA-S2-05** (automática) — Só admin e proprietário configuram. Dado um usuário sem papel válido, quando tenta conectar, testar ou desconectar, então o servidor recusa.
- **CA-S2-06** (manual) — Tela sem Embedded Signup. Dado a tela de WhatsApp aberta, quando o admin a percorre, então não existe botão de login da Meta; existe o formulário manual com instruções, o cartão de estado e os três botões.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-01 | O CRM interno usa um app Meta próprio, no mesmo portfólio verificado, com segredos separados dos do Meta Ads (`WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`); o token é de usuário de sistema, permanente. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-08 | Provas que dependem da Meta (envio real, status, templates) rodam contra o número de teste com um telefone do time como destinatário, em testes marcados para execução manual pelo desenvolvedor; o resto (webhook, janela, dedup, caixa de entrada) é provado com payloads gravados contra o banco de produção, como na S1. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
