# Spec: Skill Revisor Anti-Vibecoding

## Visão Geral

Um skill para Claude Code que revisa código gerado por IA contra boas práticas anti-vibecoding. Pode ser acionado manualmente (`/revisor`) ou automaticamente pelo `feature-flow` após cada execução de issue. Analisa o código, reporta problemas com contexto, pede confirmação e aplica correções aprovadas.

---

## Comportamento

### Acionamento

- **Manual:** `/revisor` — analisa diff da issue atual (arquivos modificados recentemente)
- **Manual completo:** `/revisor --full` — analisa o projeto inteiro
- **Automático:** acionado pelo `feature-flow` após cada `/execute`, em modo diff

### Fluxo de Execução

1. Determinar escopo: diff (padrão) ou projeto inteiro (`--full`)
2. Despachar subagentes em paralelo, um por categoria de revisão
3. Consolidar relatório com itens classificados: ✅ OK / ⚠️ Atenção / ❌ Crítico
4. Para cada problema encontrado (em ordem de criticidade):
   - Mostrar o trecho exato de código afetado
   - Explicar o que é o problema e por que importa
   - Propor a correção concreta
   - Perguntar: "Aplicar esta correção? [sim / ignorar / editar]"
5. Aplicar correções aprovadas
6. Relatório final: X problemas encontrados, Y corrigidos, Z ignorados

### Integração com feature-flow

Após cada `/execute`, o orquestrador do `feature-flow` aciona o revisor automaticamente em modo diff antes de perguntar se o usuário quer continuar para a próxima issue.

---

## Categorias de Revisão

### 1. Segurança ❗ (crítica)

- Secrets, API keys, tokens, passwords hardcoded — mesmo "temporários"
- RLS desabilitado ou ausente (especialmente em Supabase)
- Autorização ou autenticação implementada no frontend
- Proteção CSRF ausente
- Security headers não configurados
- Vulnerabilidades de SSRF em URLs construídas dinamicamente
- Queries SQL sem parametrização (SQL injection)
- Stack traces ou detalhes internos expostos em mensagens de erro ao usuário

### 2. Arquitetura

- Lógica de negócio no frontend
- Regras de validação existindo **apenas** no client-side
- Cálculos de preço, desconto ou permissão fora do backend
- Componentes com mais de uma responsabilidade (SRP violado)
- Controllers com lógica que deveria estar em services

### 3. Escopo

- Código implementa mais do que a issue descrevia
- Arquivos não listados na issue foram modificados
- Features não pedidas foram adicionadas silenciosamente
- Escopo expandido sem sinalização ao usuário

### 4. Duplicação

- Funções ou componentes que já existem no projeto (grep antes de aceitar)
- Lógica de negócio repetida em múltiplos lugares
- Utilitários criados do zero quando já havia um equivalente

### 5. Qualidade

- `catch` blocks vazios ou que apenas logam sem tratar o erro
- Edge cases não tratados: nulls, arrays vazios, valores negativos, strings vazias
- Dependências desnecessárias adicionadas ao projeto
- Ausência de tratamento de fallback para chamadas externas

### 6. Observabilidade

- Erros silenciados sem log
- Operações críticas (escrita em banco, chamadas externas) sem rastreabilidade
- Ausência de logs úteis para debugging em produção

---

## Formato do Relatório

```
## Revisão — [nome da issue ou "projeto completo"]

### ❌ Crítico (N)
[categoria] — [descrição do problema]
Arquivo: `caminho/arquivo.ts` linha X
Código: `trecho problemático`
Correção: `trecho corrigido`

### ⚠️ Atenção (N)
[mesma estrutura]

### ✅ OK (N categorias sem problemas)
```

---

## Decisões de Design

- **Por que subagentes paralelos por categoria?** Cada categoria exige um tipo diferente de análise — segurança requer busca por padrões; arquitetura requer entendimento de estrutura; duplicação requer grep no projeto. Paralelizar reduz tempo total.
- **Por que confirmar antes de corrigir?** O revisor pode errar. Contexto importa. O desenvolvedor deve entender e aprovar cada mudança — não apenas aceitar correções às cegas.
- **Por que diff por padrão?** Manter o foco no que acabou de ser gerado é mais acionável e rápido. `--full` existe para auditorias pontuais.
