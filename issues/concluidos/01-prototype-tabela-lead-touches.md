# 01: Estrutura de dados — tabela `lead_touches`

**Tipo:** Protótipo
**Página:** Modelo de Contato e Touches

## Descrição

Criar a migração da tabela `lead_touches` (uma submissão por linha), ligada ao contato (`leads`) por chave estrangeira com remoção em cascata, com os campos da submissão (funil, UTMs, identificador de campanha do Meta, identificador externo, data/hora, marcação de aquisição/retorno), políticas de acesso (RLS) e índices para consultar por contato e por ordem cronológica.

## Cobre os comportamentos
- Um contato pode ter um ou muitos touches; cada touch pertence a exatamente um contato.
- Um touch registra funil, UTMs e campanha daquela submissão específica.
- Cada touch carrega a data/hora da submissão e a marcação de aquisição ou retorno.
- A ordem cronológica dos touches permite identificar o primeiro touch (origem).
