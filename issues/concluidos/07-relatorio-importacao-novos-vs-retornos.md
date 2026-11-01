# 07: Relatório da importação por planilha — novos vs retornos

**Tipo:** Implementação
**Página:** Compatibilidade dos Pontos de Criação

## Descrição

Ajustar a tela de importação por planilha para informar corretamente, ao final, quantos **contatos novos** foram criados e quantos **retornos/touches** foram registrados, em vez de contar toda linha como um lead novo (já que o dedup no banco transforma linhas repetidas em touches de retorno).

## Cobre os comportamentos
- A importação informa, ao final, quantos contatos novos e quantos retornos/touches foram registrados.
- Linhas da mesma pessoa (na base ou no próprio arquivo) não são contadas como contatos novos.
