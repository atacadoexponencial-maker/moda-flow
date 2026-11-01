# S1-05: Atividades com anexo

**Tipo:** Implementação
**Página:** Painel do lead › Atividades
**Spec:** `spec-operacao-comercial.md`

## Descrição

Permitir anexar até 5 arquivos (imagem ou PDF, 10 MB cada) ao registrar uma atividade, guardados em armazenamento privado; miniaturas e links na linha do tempo; visualização ampliada; arquivos somem junto com o lead.

## Pronto quando

Registrar uma atividade com duas imagens e vê-las como miniaturas que ampliam ao clicar; atividade só com arquivo é aceita; arquivo grande ou de tipo errado é recusado com aviso; endereço do anexo não abre sem login; excluir o lead apaga os arquivos.

## Critérios de aceite

- **CA-S1-17** (automática) — Atividade com imagens aparece com miniaturas. Dado o formulário de nova atividade com texto e duas imagens anexadas, quando o usuário salva, então a linha do tempo mostra a atividade com o texto e as duas miniaturas, e as miniaturas abrem a imagem ampliada.
- **CA-S1-18** (automática) — Atividade só com anexo é aceita. Dado o formulário de nova atividade sem texto e com um arquivo, quando o usuário salva, então a atividade é criada mostrando o arquivo.
- **CA-S1-19** (automática) — Limite de tamanho e tipo. Dado o formulário de nova atividade, quando o usuário escolhe um arquivo acima do limite ou de tipo não aceito, então o arquivo não entra na seleção e a tela diz o motivo.
- **CA-S1-20** (automática) — Anexo é privado. Dado o endereço de um anexo, quando alguém sem login tenta abri-lo, então o acesso é negado; logado, abre normalmente.
- **CA-S1-21** (automática) — Apagar o lead apaga os anexos. Dado um lead com atividades anexadas, quando o lead é excluído, então as atividades e os arquivos anexados somem junto.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-04 | Limites de anexo: até 5 arquivos por atividade, 10 MB cada; tipos aceitos: imagens (jpg, png, webp, gif) e PDF. Validado no ClickUp em 2026-11-01: em 120 cards recentes, 108 tinham anexo (98 com 1, 8 com 2, 2 com 3); 118 PNG e 2 PDF, nenhum áudio; tamanho mediano 320 KB, máximo 439 KB. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.

## Cenários

### Happy Path
1. A migration cria o bucket privado `activity-attachments`, a tabela `activity_attachments` (um arquivo por linha, em cascata com a atividade e com o lead), os limites no banco (5 por atividade, 10 MB, imagem ou PDF), o trigger que remove o objeto do Storage quando o registro é apagado e as policies do bucket só para autenticados.
2. No formulário de atividade, a pessoa escolhe arquivos (botão clipe ou arrastar); cada um vira um chip com nome, tamanho e "x" para remover; o botão de enviar habilita com texto ou arquivos.
3. Ao salvar: a atividade é criada, cada arquivo sobe para `lead/atividade/arquivo`, o registro do anexo é gravado; a linha do tempo mostra miniaturas para imagens (clicáveis, abrem ampliadas) e links com nome e tamanho para PDF.
4. Excluir o lead apaga atividades, registros de anexo e os objetos do bucket.

### Edge Cases
- Arquivo recusado (tipo/tamanho/quantidade): não entra na seleção e um aviso diz o motivo, nome por nome.
- Falha no upload de um arquivo: a atividade já criada fica com os anexos que subiram; aviso de erro; a pessoa pode anexar de novo numa nova atividade.
- URL de anexo expirada (assinada por 1 hora): ao reabrir o painel as URLs são geradas de novo.
- Atividade antiga sem anexo: nada muda na exibição.

### Cenário de Erro
- Pessoa sem login tenta abrir a URL direta do objeto: negado pelo Storage (bucket privado, sem policy para anon).
- Inserção de 6º anexo ou arquivo fora dos limites direto no banco: recusada pelo trigger/CHECK.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-17 | automática | `src/test/integration/activity-attachments.integration.test.ts` + `src/lib/attachments.test.ts` | atividade com texto e duas imagens fica com dois registros de anexo ligados a ela, os objetos existem no bucket e são baixáveis por usuário logado; a regra de miniatura distingue imagem de PDF |
| CA-S1-18 | automática | `src/lib/attachments.test.ts` + `src/test/integration/activity-attachments.integration.test.ts` | a regra de envio aceita atividade sem texto com arquivo; o banco grava atividade com conteúdo vazio e um anexo |
| CA-S1-19 | automática | `src/lib/attachments.test.ts` + `src/test/integration/activity-attachments.integration.test.ts` | tipo não aceito, acima de 10 MB e 6º arquivo ficam fora da seleção com o motivo; o banco também recusa o 6º anexo |
| CA-S1-20 | automática | `src/test/integration/activity-attachments.integration.test.ts` | baixar o objeto sem login falha; logado, funciona |
| CA-S1-21 | automática | `src/test/integration/activity-attachments.integration.test.ts` | apagar o lead zera atividades, registros de anexo e os objetos do bucket daquele lead |

## Banco de Dados

- Bucket `activity-attachments` (privado, 10 MB, mimes: jpeg, png, webp, gif, pdf).
- Tabela `activity_attachments`: `id`, `activity_id` (FK cascade), `lead_id` (FK cascade), `path` (único), `name`, `mime` (CHECK), `size` (CHECK ≤ 10 MB), `created_at`. RLS: autenticados leem, inserem e apagam.
- Trigger `trg_activity_attachments_limit` (BEFORE INSERT): máximo 5 por atividade.
- Trigger `trg_activity_attachments_remove_object` (AFTER DELETE): remove o objeto em `storage.objects`.
- Policies em `storage.objects` para o bucket: select/insert/delete só `authenticated`.

## Arquivos

- **Criar:** `supabase/migrations/20261101150000_activity_attachments.sql`
- **Criar:** `supabase/migrations/20261101160000_activity_attachments_storage_api.sql`: a plataforma bloqueia DELETE direto em `storage.objects`; o trigger passa a chamar a API do Storage via pg_net com a service role guardada no Vault (`service_role_key`). Remoção assíncrona (segundos).
- **Criar:** `src/lib/attachments.ts`: limites, validação, `canSubmitActivity`, `isImageMime`, `formatBytes`, `buildAttachmentPath`.
- **Criar:** `src/lib/attachments.test.ts`
- **Criar:** `src/test/integration/activity-attachments.integration.test.ts`
- **Modificar:** `src/components/pipeline/LeadActivities.tsx`: seleção de arquivos, chips, envio com progresso, miniaturas/links e visualização ampliada.
- **Modificar:** `src/integrations/supabase/types.ts`: regenerado (nova tabela).

## Dependências Externas

Nenhuma nova (Storage do Supabase já em uso pelo bucket `imports`).

## Checklist

- [x] Migration aplicada (bucket, tabela, limites, trigger de remoção, policies)
- [x] `attachments.ts` + testes
- [x] `LeadActivities` com anexos (seleção, envio, miniaturas, ampliação)
- [x] Tipos regenerados
- [x] Integração rodada contra produção com limpeza conferida
