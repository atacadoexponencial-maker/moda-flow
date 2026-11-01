# Viabilidade — Integração com Hermes Agent (Nous Research)

> Análise de viabilidade de conectar o CRM (moda-flow) a um **profile do Hermes Agent**.
> Data: 2026-06-15.

## Contexto: o que é o "profile do Hermes Agent"

O **Hermes Agent** (Nous Research) é um agente de IA autônomo, *terminal-native*, open-source.
Um **profile** é uma instância isolada do agente — tem o próprio `config.yaml`, `.env`,
`SOUL.md` (identidade), memória, skills e um *gateway service*. Cria-se com
`hermes profile create`; cada profile pode:

- Expor um **API server compatível com OpenAI** (`POST /v1/chat/completions`, `/v1/responses`,
  `/v1/runs`, `/api/jobs`, `/api/sessions`), com autenticação Bearer via `API_SERVER_KEY`.
- Rodar um **messaging gateway** (WhatsApp, Telegram, Slack, Signal, SMS… 21+ canais).
- Anexar **MCP servers** (via o novo Profile Builder no dashboard local).

**Ponto crítico:** por padrão o API server escuta em `http://127.0.0.1:8642` — ou seja, roda
**localmente na máquina do usuário**, não é um SaaS multi-tenant na nuvem. A doc avisa que a
chave dá *acesso total ao toolset, incluindo comandos de terminal*.

## Como o CRM está montado hoje (pontos de integração)

- `supabase/functions/webhook-lead/index.ts` — **webhook genérico** que recebe POST com header
  `x-webhook-token`, mapeia um payload flexível (`nome`, `whatsapp`, `utm_*`, `status`…) e insere
  na tabela `leads`. É o ponto de entrada natural.
- Integração Meta Ads via OAuth (`meta-oauth-*`, `meta-fetch-insights`) — o padrão do projeto é
  **edge function como backend de integração**, guardando secrets no Supabase (alinhado à regra:
  lógica e secrets no backend).
- Frontend React/Vite + TanStack Query, sem lógica de negócio no cliente.
- Nenhuma menção a "hermes" no código — seria integração nova do zero.

## Viabilidade por cenário

| Cenário | Viabilidade | Como |
|---|---|---|
| **A. CRM → Hermes** (qualificar/enriquecer lead, gerar resposta, resumir conversa) | ✅ Alta *(tecnicamente)* | Edge function chama `/v1/chat/completions` do profile. Formato OpenAI-compatible, é só um `fetch` com Bearer. |
| **B. Hermes → CRM** (agente cria/atualiza leads, lê pipeline) | ✅ Alta | (1) o agente chama o `webhook-lead` existente; ou (2) expor o CRM como **MCP server** e anexar ao profile. |
| **C. Gateway WhatsApp do Hermes → CRM** (conversas viram leads automaticamente) | ✅ Alta | O gateway capta a conversa e dispara o `webhook-lead`. Encaixe quase perfeito com o que já existe. |

## Os dois obstáculos reais (arquitetura, não código)

1. **Hosting.** O CRM está na nuvem (Supabase/Vercel); o Hermes profile roda local. Para o
   cenário A funcionar, o Hermes precisa estar **acessível publicamente** (VPS + túnel tipo
   Cloudflare/ngrok, com host configurado). Sem isso, só funcionam os cenários em que o **Hermes
   inicia a chamada** (B e C), porque a conexão é de-dentro-para-fora.

2. **Segurança.** O `API_SERVER_KEY` dá acesso a terminal na máquina onde o Hermes roda. Expor
   isso à internet é arriscado. A chave **nunca** pode ir pro frontend — fica como secret em edge
   function (padrão já usado com a Meta). Idealmente o profile exposto deve ter o toolset restrito.

## Recomendação

**É viável, e o caminho de menor atrito é o cenário C + B:** deixar o **Hermes iniciar as
conexões** em vez de ser chamado pelo backend na nuvem.

- WhatsApp/gateway do Hermes → `webhook-lead` (zero código novo no CRM, só configurar o gateway).
- Agente atualiza o pipeline → via `webhook-lead` ou um MCP server fino que expõe `leads`.

O cenário A (CRM chamando o Hermes para usar IA) é o mais poderoso, mas exige hospedar o Hermes
num servidor público e fazer o hardening de segurança — é onde mora o custo real.

**Próximo passo sugerido:** começar pelo cenário C (gateway WhatsApp → webhook).

## Fontes

- [Hermes Agent — API Server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)
- [Hermes Agent — Profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)
- [Hermes Agent — Integrations](https://hermes-agent.nousresearch.com/docs/integrations/)
- [Nous Research ships Hermes Profile Builder (MarkTechPost)](https://www.marktechpost.com/2026/06/11/nous-research-ships-hermes-agent-profile-builder-identity-model-skills-and-mcp-servers-in-one-dashboard-flow/)
