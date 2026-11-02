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

## Cenários

### Happy Path
1. Com o número conectado, a tela de WhatsApp mostra o cartão "Templates" com a lista sincronizada (nome, idioma, categoria, status, trecho do corpo) e a data da última sincronização.
2. "Sincronizar com a Meta" chama `whatsapp-templates-sync`, que lista todos os templates da WABA seguindo `paging.next` e substitui a cópia local (upsert por id da Meta; remove os que sumiram).
3. No envio, o `TemplatePicker` mostra só aprovados (sem autenticação), campos para cada `{{n}}` do cabeçalho e do corpo, a prévia do texto final e só habilita "Enviar template" com tudo preenchido.

### Edge Cases
- Nenhum aprovado: o seletor avisa e não oferece envio.
- Template com cabeçalho de mídia: entra na lista, mas o seletor só preenche variáveis de texto (envio de cabeçalho de mídia fica fora da série).
- Valores com quebra de linha ou muitos espaços: limpos antes da prévia e do envio.

### Cenário de Erro
- Erro da Meta na sincronização: a cópia local não é tocada; toast com a mensagem.
- Sem número conectado: "Nenhum número conectado".

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-29 | automática | `src/test/whatsapp-templates.test.tsx` | com Graph simulada em duas páginas, a cópia local fica com os três templates com nome, idioma, categoria e status iguais aos da Meta; erro da Meta não toca na cópia |
| CA-S2-30 | automática | `src/test/whatsapp-templates.test.tsx` | o seletor recebe só aprovados que não são de autenticação; sem aprovados, avisa e não mostra o botão de envio |
| CA-S2-31 | automática | `src/test/whatsapp-templates.test.tsx` | "Ana" e "quarta-feira" aparecem no lugar dos marcadores na prévia; com variável vazia o envio não habilita |

## Banco de Dados

- `whatsapp_templates`: `meta_id` único, `name`, `language`, `category`, `status`, `rejected_reason`, `components` (jsonb), `synced_at`; único por (nome, idioma). RLS: autenticados leem; escrita só pela função (service role).

## Arquivos

- **Criar:** `supabase/migrations/20261101220000_whatsapp_templates.sql`
- **Criar:** `supabase/functions/_shared/whatsapp-templates.ts`: listagem paginada, sincronização, partes, variáveis, prévia, filtro de aprovados, componentes de envio.
- **Criar:** `supabase/functions/whatsapp-templates-sync/index.ts`
- **Criar:** `src/hooks/useWhatsAppTemplates.ts`
- **Criar:** `src/components/whatsapp/TemplatesCard.tsx`
- **Criar:** `src/components/whatsapp/TemplatePicker.tsx`
- **Criar:** `src/test/whatsapp-templates.test.tsx`
- **Modificar:** `src/pages/WhatsAppConfigPage.tsx`: cartão de templates quando conectado.
- **Modificar:** `supabase/config.toml`: `whatsapp-templates-sync` com verificação manual de JWT.
- **Modificar:** `src/integrations/supabase/types.ts`: regenerado.

## Dependências Externas

- Graph API v26.0: `GET /{waba_id}/message_templates` com paginação.

## Checklist

- [x] Migration aplicada e tipos regenerados
- [x] Módulo de templates + função de sincronização deployada
- [x] Cartão de templates na tela de WhatsApp
- [x] Seletor de template com variáveis e prévia
- [x] Testes dos três critérios
