# 02: Colunas normalizadas de identidade em `leads` + backfill

**Tipo:** Protótipo
**Página:** Identidade do Contato

## Descrição

Adicionar aos contatos (`leads`) as colunas que guardam o retrato normalizado de WhatsApp e email, com índices (não-únicos, pois os duplicados históricos ainda existem) para o lookup de identidade, e preencher essas colunas para os registros já existentes (backfill), de modo que submissões futuras consigam reconhecer contatos antigos.

## Cobre os comportamentos
- Cada contato guarda a forma normalizada do WhatsApp e do email.
- Os contatos que já existem na base têm o retrato normalizado preenchido.
- O índice viabiliza a busca por identidade (sem exigir unicidade nesta fase).
