# 04: Listar campos de atribuição na tela de Webhook

**Tipo:** Implementação
**Módulo:** Tela de Webhook (Módulo 4 da spec)

## Descrição

Em `src/pages/configuracoes/WebhookPage.tsx`, adicionar as linhas dos novos campos de atribuição na constante `FIELDS` (tabela "Campos aceitos"), para orientar integradores. Apenas exibição — nenhuma outra lógica da tela muda.

## Critérios de aceite

- [x] `fbc` — alternativas `—`, descrição "Identificador de clique do Facebook (cookie _fbc)".
- [x] `gclid` — alternativas `—`, descrição "Identificador de clique do Google".
- [x] `external_id` — alternativas `—`, descrição "Identificador externo do lead na origem".
- [x] `utm_term` — alternativas `term`, descrição "Termo/palavra-chave da campanha".
- [x] Nenhum outro comportamento da página é alterado.
- [x] É a única alteração de frontend da feature.

## Dependência

- Nenhuma técnica (é só texto), mas faz sentido implementar junto com as issues 02/03.

---

## Plano

### Cenários

- **Happy path:** usuário abre Configurações → Webhook; a tabela "Campos aceitos" agora lista `fbc`, `gclid`, `external_id`, `utm_term`.
- **Edge case / Erro:** nenhum — alteração puramente declarativa de dados de exibição.

### Arquivos

- **Modificar:** `src/pages/configuracoes/WebhookPage.tsx` — adicionar 4 objetos ao final do array `const FIELDS` (linhas ~21-34). Respeita thin client: só exibição, nenhuma lógica.

### Trecho previsto (ao final de `FIELDS`)

```ts
{ field: "utm_term", alternatives: "term", description: "Termo/palavra-chave da campanha" },
{ field: "fbc", alternatives: "—", description: "Identificador de clique do Facebook (cookie _fbc)" },
{ field: "gclid", alternatives: "—", description: "Identificador de clique do Google" },
{ field: "external_id", alternatives: "—", description: "Identificador externo do lead na origem" },
```

### Checklist

- [x] Adicionar as 4 entradas ao array `FIELDS`.
- [x] Não alterar nenhum outro trecho do componente.
- [x] Rodar `npm run build` para garantir que compila.
