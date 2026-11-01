# 06: Adaptar o webhook ao dedup no banco

**Tipo:** Implementação
**Página:** Compatibilidade dos Pontos de Criação

## Descrição

Ajustar o `webhook-lead` para não depender de a criação retornar sempre um registro novo: quando a submissão é tratada como retorno (nenhum contato novo criado), o webhook deve continuar respondendo sucesso e identificando o contato correspondente, em vez de falhar.

## Cobre os comportamentos
- O webhook responde sucesso e identifica o contato mesmo quando a submissão é um retorno.
