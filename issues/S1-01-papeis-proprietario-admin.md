# S1-01: Papéis proprietário e admin

**Tipo:** Implementação
**Página:** Configurações › Usuários
**Spec:** `spec-operacao-comercial.md`

## Descrição

Reduzir os papéis a "proprietario" (conta atual, única e intocável) e "admin"; tirar "vendedor" e o "proprietário" com acento da tela; fazer convite entrar como admin; e fazer as operações privilegiadas (gestão de usuários, limpar CRM) aceitarem os dois papéis.

## Pronto quando

Na tela de Usuários, a conta atual aparece como Proprietário sem ações de remover/rebaixar; um convite novo entra como Admin sem intervenção; o seletor de papel só oferece Admin; usuário sem papel é recusado nas operações privilegiadas.

## Critérios de aceite

- **CA-S1-01** (automática) — Só existem os papéis proprietário e admin. Dado o cadastro de papéis do sistema, quando alguém tenta registrar um papel diferente de "proprietario" ou "admin" (inclusive "vendedor" ou "proprietário" com acento), então o registro é recusado.
- **CA-S1-02** (automática) — A conta atual vira a proprietária. Dado a base em produção com um único usuário com papel admin, quando a mudança entra no ar, então esse usuário passa a ter o papel "proprietario" e é o único com esse papel.
- **CA-S1-03** (automática) — Proprietário não pode ser removido nem rebaixado. Dado um admin logado na tela de Usuários, quando tenta remover o proprietário ou trocar o papel dele, então a ação não aparece disponível e, se forçada, o servidor recusa.
- **CA-S1-04** (automática) — Convidado entra como admin. Dado um proprietário ou admin na tela de Usuários, quando convida um e-mail novo, então o convite é enviado e, ao aceitar, o usuário já aparece na lista como "Admin" sem ninguém precisar definir o papel.
- **CA-S1-05** (automática) — Gestão de usuários aceita proprietário e admin. Dado um usuário logado com papel proprietário ou admin, quando lista, convida ou remove usuários, ou limpa o CRM, então a operação é aceita; um usuário sem papel recebe recusa.
- **CA-S1-06** (manual) — Tela de Usuários mostra só os dois papéis. Dado a tela de Usuários aberta, quando o proprietário abre o seletor de papel de um admin, então só aparece "Admin" (o papel "Proprietário" não é atribuível pela tela) e não existe "Vendedor".

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-01 | O único usuário com login hoje (o admin existente) é a conta que vira proprietária. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
