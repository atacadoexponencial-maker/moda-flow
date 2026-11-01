# 07: Protótipo — Página /configuracoes/whatsapp + item de menu

**Tipo:** Protótipo
**Página/Módulo:** Página de Configuração do WhatsApp (`/configuracoes/whatsapp`) + Item de Menu de Configurações

## Descrição

Criar o protótipo estático (sem chamadas ao backend) da página `/configuracoes/whatsapp` e o item de menu "WhatsApp" em `/configuracoes`, espelhando o visual da página de Meta Ads.

## Checklist de componentes (UI estática)

- [ ] Adicionar rota `/configuracoes/whatsapp` em `App.tsx` dentro do `AppLayout`.
- [ ] Adicionar item de menu "WhatsApp" em `ConfiguracoesPage.tsx` (rótulo, ícone, descrição curta) que navega para `/configuracoes/whatsapp`.
- [ ] Cabeçalho: título "Integração WhatsApp", subtítulo explicativo e botão de voltar para `/configuracoes`.
- [ ] Cartão "Conexão WhatsApp Business" com dois estados mockados:
  - [ ] Estado desconectado: texto explicativo + botão "Conectar WhatsApp".
  - [ ] Estado conectado: `display_phone_number`, `verified_name`, `waba_id` legível e badge "Conectado".
- [ ] Botões "Testar conexão" e "Desconectar" no estado conectado.
- [ ] Spinners nos botões (estado de loading mockado) e estrutura para toasts de feedback.

## Notas

- Apenas UI com dados mockados; sem integração nesta issue (integração na issue 08).
- Reutilizar componentes shadcn/ui (Card, Button, Badge) e o padrão visual de `meta-ads`.
- Usar ícone do WhatsApp já disponível em `lucide-react`/assets, se houver.

## Cenários (visual)

Estado controlado por `const [conectado] = useState(false)` (mock local, sem rede).

- **Desconectado** (`conectado === false`):
  - Cartão "Conexão WhatsApp Business" com texto explicativo centralizado.
  - Botão verde "Conectar WhatsApp" (cor da marca `#25D366`), com ícone `MessageCircle` e `Loader2` para o estado de loading mockado.
- **Conectado** (`conectado === true`):
  - Avatar circular verde + `verified_name` (mock) e `display_phone_number` (mock) abaixo.
  - Badge "Conectado" (verde, mesmo estilo do `tokenStatus.success` da Meta Ads).
  - Linha com `waba_id` legível (mock).
  - Botões "Testar conexão" (`outline`, ícone `RefreshCw`) e "Desconectar" (`outline` destrutivo, ícone `LogOut`), ambos com `Loader2` mockado.

Espelha exatamente o cabeçalho (botão voltar `ArrowLeft` + título + subtítulo) e o cartão de conexão de `MetaAdsConfigPage.tsx`. Não inclui os cartões "Configurações" e "Sincronização" da Meta Ads (fora do escopo desta integração).

## Arquivos

- **Criar:** `src/pages/WhatsAppConfigPage.tsx` (mesmo diretório/padrão de `MetaAdsConfigPage.tsx`).
- **Modificar:** `src/App.tsx` — import + rota `/configuracoes/whatsapp` dentro do `AppLayout`.
- **Modificar:** `src/pages/ConfiguracoesPage.tsx` — card "Integração WhatsApp" navegando para `/configuracoes/whatsapp` (ícone `MessageCircle`).

## Checklist refinado

- [x] Criar `src/pages/WhatsAppConfigPage.tsx` espelhando o cabeçalho e o cartão de conexão da Meta Ads.
- [x] Estado mock `const [conectado] = useState(false)` alternando os dois cenários.
- [x] Desconectado: texto + botão "Conectar WhatsApp" (com spinner mock).
- [x] Conectado: `display_phone_number`, `verified_name`, `waba_id` (mock) + Badge "Conectado" + botões "Testar conexão" e "Desconectar" (com spinners mock).
- [x] Handlers vazios (`console.log`), sem chamadas a Supabase/Edge Functions.
- [x] Adicionar rota `/configuracoes/whatsapp` em `App.tsx`.
- [x] Adicionar card "Integração WhatsApp" em `ConfiguracoesPage.tsx` (ícone `MessageCircle`).
