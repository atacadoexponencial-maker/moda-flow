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

## Cenários

### Happy Path
1. Admin abre Configurações › WhatsApp sem conexão: vê o formulário (WABA, identificador do número, token) e as instruções com a URL do webhook.
2. Ao conectar, a função `whatsapp-connect` confere na Meta, nesta ordem: dados do número (valida token e permissão), se o número pertence à WABA e assina o app à WABA. Só então grava o token no Vault (`whatsapp_access_token`) e a configuração (ativo, número, nome, qualidade, data da assinatura).
3. O cartão de estado mostra nome verificado, número, qualidade, data da assinatura e WABA; botões Testar, Trocar número e Desconectar.
4. Trocar número reabre o formulário com a WABA preenchida; ao confirmar, a mesma função reescreve a configuração e o token.

### Edge Cases
- IDs com letras ou token curto: recusado antes de chamar a Meta, com mensagem clara.
- Número de outra WABA: "Esse número não pertence à conta (WABA) informada."
- App sem permissão de assinar: erro da etapa "Assinatura do webhook" e nada gravado.
- Desconectar sem token guardado: só marca inativo.

### Cenário de Erro
- Erro da Meta: a resposta traz `success: false`, a etapa e a mensagem da Meta; a tela mostra em toast.
- Falha ao gravar no Vault/tabela: etapa "gravacao"; nada parcial na tela.
- Usuário sem papel: 403; sem login: 401.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-01 | automática | `src/test/whatsapp-connection.test.ts` + `src/test/integration/whatsapp-config.integration.test.ts` | com Graph simulada, conexão válida fica ativa, assina a WABA e a resposta não contém o token; no banco, a view lida pelo navegador não tem token nem referência ao Vault e a tabela base é ilegível |
| CA-S2-02 | automática | `src/test/whatsapp-connection.test.ts` | token inválido, número de outra conta ou falha na assinatura devolvem o erro da Meta e não gravam nada |
| CA-S2-03 | automática | `src/test/whatsapp-connection.test.ts` | testar devolve número, nome verificado e qualidade; erro da Meta vira mensagem |
| CA-S2-04 | automática | `src/test/whatsapp-connection.test.ts` | trocar para o número B reescreve só a configuração; o armazenamento da conexão não tem operação sobre conversas |
| CA-S2-05 | automática | `src/test/integration/whatsapp-config.integration.test.ts` | usuário sem papel recebe 403 em conectar, testar e desconectar; sem login, 401; configuração intacta |
| CA-S2-06 | manual | roteiro abaixo | tela sem login da Meta, com formulário, instruções, cartão e botões |

### Roteiro manual — CA-S2-06
1. Logar como proprietária e abrir Configurações › WhatsApp.
2. Conferir que não existe botão "Conectar com Facebook"/login da Meta.
3. Conferir o formulário com WABA ID, Identificador do número e Token (campo oculto) e o cartão "Onde encontrar cada dado" com a URL do webhook.
4. Depois de conectar (com os dados reais do app), conferir o cartão com nome, número, qualidade, webhook assinado e os botões Testar conexão, Trocar número e Desconectar.

## Banco de Dados

- `whatsapp_config`: novas colunas `quality_rating` (text) e `webhook_subscribed_at` (timestamptz).
- View `whatsapp_config_safe` recriada com esses campos e `updated_at`; só `authenticated` lê; sem token nem `vault_secret_id`.
- Vault: segredo `whatsapp_access_token` (upsert por nome; trocar número sobrescreve).

## Arquivos

- **Criar:** `supabase/migrations/20261101200000_whatsapp_config_manual.sql`
- **Criar:** `supabase/functions/_shared/whatsapp-graph.ts`: chamadas Graph (número, números da WABA, assinar/desassinar) com `fetch` injetado.
- **Criar:** `supabase/functions/_shared/whatsapp-connection.ts`: `connectNumber`, `testConnection`, `validateConnectInput`, `qualityLabel`.
- **Criar:** `supabase/functions/_shared/edge.ts`: CORS, `json`, `authenticate`, `requireCrmRole`, `readWhatsAppToken`.
- **Criar:** `supabase/functions/whatsapp-connect/index.ts`
- **Criar:** `src/test/whatsapp-connection.test.ts`
- **Criar:** `src/test/integration/whatsapp-config.integration.test.ts`
- **Modificar:** `supabase/functions/whatsapp-test-connection/index.ts`: papel exigido, módulo compartilhado, atualiza qualidade.
- **Modificar:** `supabase/functions/whatsapp-disconnect/index.ts`: papel exigido, desassina a WABA (melhor esforço).
- **Modificar:** `supabase/config.toml`: sai signup, entra `whatsapp-connect`.
- **Modificar:** `src/hooks/useWhatsAppConfig.ts`: sem SDK do Facebook; conectar por formulário.
- **Modificar:** `src/pages/WhatsAppConfigPage.tsx`: formulário, cartão de estado, trocar número, instruções.
- **Modificar:** `src/integrations/supabase/types.ts`: regenerado.
- **Remover:** `supabase/functions/whatsapp-signup-start/index.ts`
- **Remover:** `supabase/functions/whatsapp-signup-exchange/index.ts`
- **Remover:** `src/types/facebook-sdk.d.ts`

## Dependências Externas

- Graph API do WhatsApp Cloud API v26.0 (`GET /{phone_number_id}`, `GET /{waba_id}/phone_numbers`, `POST|DELETE /{waba_id}/subscribed_apps`).

## Checklist

- [x] Migration aplicada e tipos regenerados
- [x] Módulos compartilhados (Graph, conexão, edge) + testes
- [x] `whatsapp-connect` criada; test-connection e disconnect com papel
- [x] Embedded Signup removido (funções apagadas no Supabase, SDK fora do front)
- [x] Tela com formulário, cartão de estado, trocar número e instruções
- [x] Integração rodada contra produção com limpeza conferida
