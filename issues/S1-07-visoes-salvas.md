# S1-07: Visões salvas de filtros

**Tipo:** Implementação
**Página:** Pipeline e Leads
**Spec:** `spec-operacao-comercial.md`

## Descrição

Permitir salvar a combinação de filtros com um nome, reabrir, renomear e excluir visões próprias; oferecer visões prontas ("Leads Hoje", "Meus leads", uma por funil existente) não editáveis; lembrar a última visão usada por página. Visões são pessoais.

## Pronto quando

Aplicar filtros, salvar como "Workshop quente", sair e voltar: a visão está aplicada e aparece no seletor junto das prontas; outro usuário não a vê; "Leads Hoje" não oferece renomear/excluir.

## Critérios de aceite

- **CA-S1-27** (automática) — Salvar e reabrir visão. Dado filtros aplicados no Pipeline, quando o usuário salva como "Workshop quente" e depois seleciona essa visão, então os mesmos filtros são aplicados e a lista corresponde.
- **CA-S1-28** (automática) — Visões prontas disponíveis. Dado um usuário novo sem visões salvas, quando abre o seletor, então vê "Leads Hoje", "Meus leads" e uma visão por funil existente na base.
- **CA-S1-29** (automática) — Visões são pessoais. Dado uma visão salva pelo usuário A, quando o usuário B abre o seletor, então não vê a visão de A.
- **CA-S1-30** (automática) — Última visão reabre. Dado o usuário usou a visão "Workshop quente" e saiu da página, quando volta ao Pipeline, então a visão "Workshop quente" está aplicada.
- **CA-S1-31** (automática) — Visão pronta não é editável. Dado a visão "Leads Hoje" selecionada, quando o usuário procura renomear ou excluir, então as ações não estão disponíveis.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
Nenhuma.

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-02 | As visões prontas por funil devem ser uma por valor de funil existente na base (hoje 7) ou só os funis principais (Sessão Estratégica, Lives, Workshop)? | respondida | Uma por funil existente na base; novos funis aparecem sozinhos. Marcelle, 2026-11-01. |
