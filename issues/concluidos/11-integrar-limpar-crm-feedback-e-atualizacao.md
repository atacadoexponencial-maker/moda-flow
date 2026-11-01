# 11: Integração — Chamada ao backend, feedback e atualização da UI

**Tipo:** Implementação
**Página:** Diálogo de Confirmação + Resultado da Operação

## Descrição
Conectar o diálogo de confirmação (issue 09) à função privilegiada (issue 10): disparar a limpeza ao confirmar, controlar o estado de carregamento, exibir toasts de sucesso/erro e invalidar as queries do React Query para refletir a base vazia em pipeline, leads, atividades do dia e dashboard.

## Escopo / Comportamentos
- **Confirmar a exclusão:** com a frase correta digitada, acionar o botão destrutivo dispara a solicitação ao servidor (mutation React Query).
- **Estado de carregamento:** durante o processamento, botões desabilitados, indicador de carregamento e fechamento/cancelamento bloqueados (impede cliques repetidos).
- **Exibir sucesso:** ao concluir, fechar o diálogo e mostrar toast de sucesso confirmando a limpeza e, quando disponível, a quantidade de registros removidos.
- **Atualizar a interface:** invalidar as queries dependentes de leads e atividades para que pipeline, lista de leads, atividades do dia e painéis/indicadores reflitam a base vazia sem recarregar a página.
- **Exibir erro:** em falha, mostrar toast de erro orientando a tentar novamente; o diálogo retorna do estado de carregamento para o estado interativo; nenhuma alteração parcial é apresentada como sucesso.
- **Reabrir em estado limpo:** após sucesso ou cancelamento, reabrir o diálogo com campo vazio e botão destrutivo desabilitado.

## Notas de arquitetura
- Usar TanStack React Query (`useMutation`) e o padrão de toast já existente no projeto (pesquisar `useToast`/`sonner` em `src/`).
- Identificar e invalidar as `queryKey`s usadas por pipeline, leads, hoje e dashboard.
- Cliente apenas captura intenção e exibe resposta; toda a lógica de exclusão permanece no backend (issue 10).

## Dependência
Requer a função da issue 10 disponível para chamada.

---

## Pesquisa de reuso (padrões reais do projeto)

- **Cliente Supabase:** `import { supabase } from "@/integrations/supabase/client";`
- **Chamar Edge Function:** padrão usado em `MetaAdsConfigPage.tsx` / `UsersPage.tsx`:
  ```ts
  const { data, error } = await supabase.functions.invoke("clear-crm");
  ```
  A função `clear-crm` (issue 10) não exige `body`. Retorno de sucesso:
  `{ success: true, deleted: { activities: number, leads: number } }`.
  Em falha, `error` vem preenchido (status 401/403/500). Tratar também o caso de
  `data` sem `success` por segurança.
- **Toast:** o projeto usa **sonner** (não `useToast`). Padrão em `MetaAdsConfigPage.tsx`:
  ```ts
  import { toast } from "sonner";
  toast.success("...");
  toast.error("...");
  ```
- **QueryClient:** `import { useQueryClient } from "@tanstack/react-query";` → `const queryClient = useQueryClient();`
  (padrão usado em `PipelinePage.tsx`, `NewLeadDialog.tsx`, `LeadDetailPanel.tsx`).
- **Mutation:** `import { useMutation } from "@tanstack/react-query";` para o estado de
  carregamento (`mutation.isPending`) — substitui o `isLoading`/`setTimeout` do mock.

## Cenários

### Happy Path
1. Admin abre o cartão "Limpar CRM", digita exatamente `LIMPAR CRM` e clica no botão destrutivo.
2. A mutation chama `supabase.functions.invoke("clear-crm")`; botões e campo ficam desabilitados, botão mostra spinner "Limpando...", fechar/cancelar/Esc bloqueados.
3. Retorno `{ success: true, deleted: { activities, leads } }`: o diálogo fecha, campo é limpo e dispara `toast.success` informando a quantidade removida (ex.: `"CRM limpo: 12 leads e 34 atividades removidos."`).
4. As queries dependentes são invalidadas; pipeline, lista de leads e atividades de hoje passam a refletir a base vazia sem recarregar a página.

### Edge Cases
- **Reabrir em estado limpo:** após sucesso ou cancelamento, reabrir o diálogo deve mostrar campo vazio e botão destrutivo desabilitado (o `resetState`/limpeza de `confirmText` já cobre isso — manter).
- **Cliques repetidos:** enquanto `mutation.isPending`, ignorar novo clique no botão e bloquear `onOpenChange`/`onEscapeKeyDown` (comportamento já presente; trocar a guarda de `isLoading` por `mutation.isPending`).
- **Base já vazia:** a função retorna `deleted: { activities: 0, leads: 0 }`; ainda é sucesso — exibir toast de sucesso (mensagem genérica ou com "0") e invalidar mesmo assim.
- **Dashboard:** `DashboardPage` NÃO usa React Query (carrega via `useEffect`/`useState` no mount, deps `[]`), portanto não há `queryKey` para invalidar. Ele já recarrega do zero ao navegar para a página. **Não** refatorar o Dashboard nesta issue (fora de escopo); apenas documentar a limitação.

### Cenário de Erro
- `error` preenchido (Unauthorized 401, Forbidden 403, ou "Erro interno" 500) **ou** resposta sem `success`: lançar/propagar o erro na `mutationFn` para cair no `onError`.
- `onError`: `toast.error("Não foi possível limpar o CRM. Tente novamente.")`; o diálogo **permanece aberto** e volta do estado de carregamento para o interativo (`isPending` volta a `false` automaticamente); o campo `confirmText` é **mantido** para o usuário reenviar; nenhuma alteração parcial é apresentada como sucesso (não fechar, não invalidar).

## Arquivos
- **Modificar:** `src/components/configuracoes/LimparCrmCard.tsx` — remover o mock (`setTimeout`/`isLoading` manual); adicionar `useMutation` chamando `supabase.functions.invoke("clear-crm")`; usar `mutation.isPending` no lugar de `isLoading`; `onSuccess` → fechar diálogo + `resetState` + `toast.success` (com contagem de `deleted`) + invalidar queries; `onError` → `toast.error` mantendo o diálogo aberto. Adicionar imports: `useMutation`, `useQueryClient` (`@tanstack/react-query`), `toast` (`sonner`), `supabase` (`@/integrations/supabase/client`).

_Nenhum outro arquivo precisa ser criado ou alterado. Componente da issue 09 e Edge Function da issue 10 são reutilizados como estão._

## Query Keys a invalidar
Invalidar via `queryClient.invalidateQueries({ queryKey: [...] })` no `onSuccess`:

- `['leads-pipeline']` — `src/pages/PipelinePage.tsx:172` (board do pipeline)
- `['leads-table']` — `src/pages/LeadsPage.tsx:259` (lista/tabela de leads)
- `['leads-hoje']` — `src/pages/HojePage.tsx:91` (chave real é `['leads-hoje', todayStr]`; invalidar pelo prefixo `['leads-hoje']` cobre todas as variações de data via match parcial do React Query)

> Observação: `['lead-field-definitions']`, `['webhook_config']` e a chave do WhatsApp NÃO são afetadas (não dependem de leads/atividades). O Dashboard não possui `queryKey` (ver Edge Cases).

## Checklist
- [x] Remover o mock (`setTimeout` e `setIsLoading`) do `handleConfirm`
- [x] Adicionar imports: `useMutation`, `useQueryClient`, `toast` (sonner), `supabase` (client)
- [x] Criar `useMutation` cuja `mutationFn` chama `supabase.functions.invoke("clear-crm")` e lança erro se `error` existir ou `data.success !== true`
- [x] Substituir o estado `isLoading` por `mutation.isPending` em todas as guardas e na UI (botões, campo, `onOpenChange`, `onEscapeKeyDown`, spinner)
- [x] `onSuccess`: fechar o diálogo, limpar `confirmText`, `toast.success` com a contagem de `deleted.leads` e `deleted.activities`
- [x] `onSuccess`: invalidar `['leads-pipeline']`, `['leads-table']`, `['leads-hoje']`
- [x] `onError`: `toast.error` mantendo o diálogo aberto e o `confirmText` preenchido (sem invalidar, sem fechar)
- [x] Garantir reabertura em estado limpo após sucesso/cancelamento (campo vazio, botão desabilitado)
- [x] `npm run lint` e `npm run build` sem erros
