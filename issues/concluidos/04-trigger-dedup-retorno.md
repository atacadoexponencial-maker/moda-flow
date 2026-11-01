# 04: Regra central de dedup — contato existente vira touch de retorno

**Tipo:** Implementação
**Página:** Ingestão e Deduplicação (todos os pontos de criação)

## Descrição

Criar a regra central no banco que intercepta toda criação de lead: normaliza a identidade, procura contato existente (o mais antigo, quando houver duplicados) e, se existir, registra um touch de **retorno** ligado a esse contato **sem criar um novo contato** e **sem alterar** o card existente (funil, etapa, nome, valores, origem). Inclui proteção contra concorrência para que duas criações simultâneas da mesma pessoa nova não gerem dois contatos.

## Cobre os comportamentos
- Criação de contato existente não cria novo contato: registra touch de retorno.
- Touch de retorno não altera o card do contato (funil/etapa/nome/valores/origem).
- Vale para todos os pontos de criação (webhook, importação na tela, criação manual).
- Submissão é associada ao contato mais antigo quando há duplicados históricos.
- Duas criações simultâneas da mesma pessoa nova não criam dois contatos.
- Criações sem WhatsApp e sem email são tratadas como contato novo.
