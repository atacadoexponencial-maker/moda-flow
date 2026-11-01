# 09: Protótipo — Cartão "Limpar CRM" e Diálogo de Confirmação Destrutiva

**Tipo:** Protótipo
**Página:** Configurações (`/configuracoes`)

## Descrição
Criar a interface estática da ação destrutiva "Limpar CRM": um cartão de alerta na página de Configurações e o diálogo modal de confirmação com digitação de frase exata. Apenas UI e estados visuais, sem chamada ao backend.

## Escopo

### Cartão "Limpar CRM"
- Novo item na lista de cartões de Configurações, posicionado abaixo das demais opções.
- Estilo de destaque negativo/alerta (cor destrutiva) para diferenciá-lo dos cartões comuns e sinalizar irreversibilidade.
- Conteúdo: ícone de alerta, título "Limpar CRM", descrição curta informando que a ação apaga todos os leads e atividades de todos os usuários de forma permanente, e botão de ação destrutiva ("Limpar CRM").
- Acionar o botão abre o diálogo de confirmação.

### Diálogo de Confirmação Destrutiva
- Modal sobreposto que bloqueia o restante da interface.
- Título de alerta deixando explícito que a ação apaga todos os leads e atividades de todos os usuários.
- Mensagem enfática: operação permanente, irreversível, não pode ser desfeita, afeta dados de todos os usuários.
- Exibe a frase exata exigida (ex.: `LIMPAR CRM`).
- Campo de texto para digitação da confirmação.
- Botão de confirmação destrutiva desabilitado enquanto o texto não coincidir exatamente com a frase esperada (validação em tempo real).
- Botão de cancelamento que fecha o diálogo sem ação.
- Estado de carregamento (mock): indicador no lugar do botão de confirmação, botões desabilitados e fechamento bloqueado durante o processamento.
- Ao reabrir após cancelar, o campo volta vazio e o botão destrutivo desabilitado.

## Fora de escopo
- Chamada ao servidor, toasts e invalidação de queries (issue 11).
- Função privilegiada de exclusão (issue 10).

## Notas de arquitetura
- Usar componentes shadcn/ui já existentes (Card, AlertDialog/Dialog, Button, Input). Pesquisar `src/components/ui/` antes de criar algo novo.
- UI em pt-BR.

## Cenários

### Happy Path
1. Usuário acessa `/configuracoes` (`src/pages/ConfiguracoesPage.tsx`).
2. Abaixo dos demais cartões aparece o cartão "Limpar CRM" com estilo destrutivo (borda/ícone em `text-destructive`), ícone de alerta (`AlertTriangle` do `lucide-react`), título, descrição de irreversibilidade e botão `variant="destructive"`.
3. Usuário clica em "Limpar CRM" → abre o `AlertDialog` controlado (estado `open`).
4. O diálogo mostra título de alerta, mensagem enfática (permanente/irreversível/afeta todos os usuários), a frase exigida em destaque (`LIMPAR CRM`) e um `Input` vazio.
5. O botão destrutivo de confirmação começa desabilitado.
6. Usuário digita exatamente `LIMPAR CRM` → validação em tempo real (`value === "LIMPAR CRM"`) habilita o botão.
7. Usuário clica em confirmar → estado `isLoading` (mock via `setTimeout`): botão mostra `Loader2 animate-spin` + texto "Limpando...", botões ficam desabilitados e o fechamento (Esc) é bloqueado.
8. Após o mock terminar, o diálogo fecha e o estado é resetado (sem chamada real — backend é a issue 11).

### Edge Cases
- Texto digitado diferente da frase (ex.: `limpar crm`, com espaços extras, parcial) mantém o botão desabilitado (comparação exata, sensível a maiúsculas).
- Cancelar com o `AlertDialogCancel` (ou Esc, quando não está em loading) fecha sem ação e reseta o campo: ao reabrir, `Input` vazio e botão desabilitado novamente.
- Durante `isLoading`: `AlertDialogCancel` desabilitado, botão de confirmar desabilitado, e `onEscapeKeyDown`/`onOpenChange` impedidos de fechar o modal.
- Reabrir após um fluxo cancelado não deve manter texto residual (reset do `useState` no fechamento).

### Cenário de Erro
- Não aplicável nesta issue (sem backend). O clique em confirmar apenas simula o processamento com `setTimeout` e então fecha. Tratamento de erro/toasts de falha ficam para a issue 11.

## Arquivos
- **Criar:** `src/components/configuracoes/LimparCrmCard.tsx` — componente autocontido (isolamento por comportamento) com o cartão destrutivo + `AlertDialog` controlado. Mantém estados locais `open`, `confirmText` e `isLoading`. Usa `Card`/`CardContent`, `Button` (`variant="destructive"`), `AlertDialog*`, `Input`, `Label` de `@/components/ui/*`, ícones `AlertTriangle` e `Loader2` de `lucide-react`. Constante `CONFIRM_PHRASE = "LIMPAR CRM"`. Confirmação faz apenas `setTimeout` mock (placeholder para a issue 11) e reseta estado ao fechar.
- **Modificar:** `src/pages/ConfiguracoesPage.tsx` — importar e renderizar `<LimparCrmCard />` como último item dentro da `<div className="space-y-6">`, após o cartão de Webhook (linha ~99).

## Checklist
- [x] Criar `src/components/configuracoes/LimparCrmCard.tsx` com o cartão de estilo destrutivo (ícone `AlertTriangle`, título "Limpar CRM", descrição de irreversibilidade, botão `variant="destructive"`).
- [x] Implementar `AlertDialog` controlado por estado `open`, abrindo ao clicar no botão do cartão.
- [x] Adicionar título/descrição enfáticos em pt-BR e exibir a frase exata `LIMPAR CRM` em destaque.
- [x] Adicionar `Input` controlado (`confirmText`) com `Label` instruindo a digitar a frase.
- [x] Desabilitar o botão de confirmação enquanto `confirmText !== "LIMPAR CRM"` (validação em tempo real, exata e case-sensitive).
- [x] Implementar estado `isLoading` mock (`setTimeout`) com `Loader2 animate-spin` no botão, botões desabilitados e bloqueio de fechamento (Esc/outside).
- [x] Resetar `confirmText` e `isLoading` ao fechar/cancelar para que reabrir traga o campo vazio e botão desabilitado.
- [x] Importar e renderizar `<LimparCrmCard />` ao final da lista de cartões em `src/pages/ConfiguracoesPage.tsx`.
- [x] Não incluir chamada ao backend, toasts de sucesso/erro ou invalidação de queries (issue 11).
- [x] Rodar `npm run lint` sem novos erros.
