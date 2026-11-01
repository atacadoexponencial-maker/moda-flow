# 06: Módulo de webhook do WhatsApp (`whatsapp-webhook`) — handshake only

**Tipo:** Implementação
**Página/Módulo:** Módulo de Webhook do WhatsApp (`whatsapp-webhook`)

## Descrição

Criar a Edge Function pública que responde ao handshake de verificação do Meta e aceita entregas de eventos com assinatura válida, sem processar o conteúdo (processamento é Fase 2).

## Checklist de comportamentos

- [x] Responder ao handshake (GET): comparar `hub.verify_token` com o token esperado no backend; se conferir, devolver `hub.challenge`.
- [x] Rejeitar verificação inválida: recusar quando o token de verificação não conferir.
- [x] Validar assinatura (POST): verificar `X-Hub-Signature-256`; rejeitar entregas com assinatura inválida.
- [x] Aceitar entregas válidas com `200` sem processar o conteúdo nesta fase.
- [x] Garantir idempotência: tratar entregas repetidas sem efeitos colaterais, deixando preparado para o processamento da Fase 2.
- [x] Manter segredos no backend: `verify_token` e segredo de assinatura apenas em variáveis de ambiente.

## Notas

- Endpoint público — desabilitar `verify_jwt` (espelhar config de `webhook-lead`).
- Deploy via Lovable, com `verify_jwt = false` e variáveis de ambiente do verify_token e app secret (incluir prompt Lovable).

## Padrão Documentado

Fontes oficiais do Meta:
- Graph API Webhooks — Getting Started: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
- WhatsApp Cloud API — Set Up Webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks

**Handshake de verificação (GET):** o Meta envia três query params:
- `hub.mode` — sempre `"subscribe"`.
- `hub.verify_token` — string definida no painel do app; o endpoint deve compará-la com o token esperado guardado no backend.
- `hub.challenge` — valor (inteiro) que deve ser ecoado de volta.

Se `hub.mode === "subscribe"` **e** `hub.verify_token` confere com o token esperado → responder `200` com o **corpo = `hub.challenge` em texto puro** (não JSON, sem aspas). Caso contrário → `403`.

**Assinatura de eventos (POST):** o payload chega com o header `X-Hub-Signature-256`, no formato `sha256=<hmac_hex>`. O HMAC é calculado com SHA-256 usando o **App Secret** como chave e o **corpo bruto/não-escapado da requisição** como mensagem. Validação:
1. Ler o corpo BRUTO exatamente como recebido (`await req.text()`), sem reparse/reserialize — qualquer transformação quebra a assinatura.
2. Calcular `HMAC-SHA256(corpo_bruto, META_APP_SECRET)` e converter para hex.
3. Remover o prefixo `sha256=` do header e comparar (tempo constante) com o hex calculado.
4. Se inválida → `401`. Se válida → `200` (nesta fase, sem processar o conteúdo).

## Cenários

1. **Handshake OK (GET):** `hub.mode=subscribe` + `hub.verify_token` correto → `200`, corpo = `hub.challenge` (texto puro).
2. **Handshake token errado (GET):** `hub.verify_token` não confere (ou `hub.mode` ≠ `subscribe`) → `403`.
3. **POST assinatura válida:** `X-Hub-Signature-256` bate com o HMAC do corpo bruto → `200`, sem processar conteúdo (Fase 2).
4. **POST assinatura inválida / ausente:** header faltando ou HMAC não confere → `401`.
5. **OPTIONS (preflight CORS):** responde `200`/`204` com os headers de CORS.

## Arquivos

- `supabase/functions/whatsapp-webhook/index.ts` — nova Edge Function (handshake GET + validação de assinatura POST).
- `supabase/config.toml` — nova entrada `[functions.whatsapp-webhook]` com `verify_jwt = false`.

## Variáveis de ambiente

- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — token de verificação esperado no handshake GET (definido também no painel do Meta).
- `META_APP_SECRET` — App Secret usado como chave do HMAC-SHA256 para validar `X-Hub-Signature-256`.

(Ambas configuradas como secrets no backend Supabase via Lovable — nunca no frontend.)

## Checklist refinado

- [x] `GET`: ler `hub.mode`, `hub.verify_token`, `hub.challenge` da query; se `mode==="subscribe"` e token confere → `200` com corpo = `hub.challenge` (texto puro); senão `403`.
- [x] `POST`: ler corpo bruto via `await req.text()`; calcular HMAC-SHA256(corpo, `META_APP_SECRET`) com Web Crypto; comparar em hex (tempo constante) com `x-hub-signature-256` sem o prefixo `sha256=`.
- [x] `POST` assinatura inválida/ausente → `401`.
- [x] `POST` assinatura válida → `200` sem processar conteúdo (comentar que o processamento é Fase 2).
- [x] `OPTIONS`/CORS tratados conforme padrão.
- [x] `supabase/config.toml`: adicionar `[functions.whatsapp-webhook]` com `verify_jwt = false` (espelhar `webhook-lead`).
- [x] Segredos (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`) apenas em env do backend.
- [x] Não fazer deploy; não editar `types.ts`.
