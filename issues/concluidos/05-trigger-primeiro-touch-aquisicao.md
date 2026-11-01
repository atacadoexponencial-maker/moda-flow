# 05: Regra central de dedup — contato novo gera primeiro touch (aquisição)

**Tipo:** Implementação
**Página:** Ingestão e Deduplicação (todos os pontos de criação)

## Descrição

Quando a criação corresponde a um contato que não existe, manter a criação do contato e registrar automaticamente o **primeiro touch** desse contato, marcado como **aquisição**, com os dados da criação (funil, UTMs, campanha do Meta, identificador externo, data/hora; quando não houver data, o momento da criação). A marcação aquisição/retorno é gravada no momento do registro e não muda depois.

## Cobre os comportamentos
- Criação de contato inexistente cria contato + primeiro touch (aquisição).
- O primeiro touch guarda funil, UTMs, campanha do Meta, identificador externo e data/hora.
- Sem data informada, a data do touch é o momento da criação.
- Touch é aquisição quando o contato ainda não existia; retorno quando já existia em qualquer funil.
- A classificação é determinada no registro e não muda depois.
- No primeiro touch, funil e UTMs do contato representam a origem; submissões posteriores não sobrescrevem.
