# 03: Função de normalização de identidade (no banco)

**Tipo:** Implementação
**Página:** Identidade do Contato

## Descrição

Criar a função única de normalização de identidade no banco: WhatsApp reduzido a dígitos, ignorando formatação (espaços, parênteses, traços, ponto, "+") e o código do país 55; email em minúsculas e sem espaços nas pontas. Essa função é a fonte única da regra, usada pelo trigger de dedup e pelo backfill.

## Cobre os comportamentos
- Reconhecer como a mesma pessoa números equivalentes, independente de formatação e do DDI 55.
- Comparação de email ignora maiúsculas/minúsculas e espaços nas pontas.
- Regra de normalização única, reaproveitada por toda a ingestão e por sub-projetos futuros.
