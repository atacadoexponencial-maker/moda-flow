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
