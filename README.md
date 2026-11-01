# moda-flow — CRM interno

CRM de gestão de leads e pipeline comercial de uso interno. Substitui o CRM que roda hoje
no ClickUp. Os leads chegam pelo tracking (`tracking-avancado`) via webhook e são
deduplicados no banco por WhatsApp/e-mail, com histórico de entradas (touches).

## Stack

- **Frontend:** React 18 + TypeScript + Vite, shadcn/ui (Radix + Tailwind), TanStack Query,
  React Router v6, @dnd-kit, Recharts. Interface em pt-BR.
- **Backend:** Supabase (Postgres com RLS, Edge Functions em Deno, Vault para segredos,
  pg_cron para sincronizações).
- **Deploy:** frontend na Vercel (produção a partir de `origin/main`); backend via Supabase CLI.

## Rodando localmente

```sh
npm i
npm run dev        # http://localhost:8080
npm run test       # Vitest
npm run lint       # ESLint
npx tsc -p tsconfig.app.json --noEmit   # typecheck (o build do Vite não checa tipos)
```

Variáveis de ambiente em `.env` (não commitado): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

## Deploy

- **Frontend:** push em `origin/main` dispara o deploy na Vercel. O trabalho local é em `master`.
- **Migrations:** `supabase db push`
- **Edge Functions:** `supabase functions deploy <nome>` (ou sem nome para todas)
- **Tipos:** `supabase gen types typescript --project-id ynjxvzjomizfyabupvne > src/integrations/supabase/types.ts`

Detalhes de arquitetura e convenções em `CLAUDE.md`.

## Mapa do projeto

- `src/pages/` páginas roteadas (pipeline, leads, hoje, dashboard, configurações)
- `src/components/` componentes por funcionalidade; `ui/` são os primitivos do shadcn
- `src/lib/` regras puras testadas (estágios do funil, filtros, métricas do dashboard)
- `supabase/functions/` Edge Functions (webhook de leads, importação CSV, Meta Ads, WhatsApp, usuários)
- `supabase/migrations/` schema, triggers de dedup/touches, cron
- `issues/` issues do fluxo de desenvolvimento (`concluidos/` e `descartadas/`)
- `docs/specs-arquivadas/` specs de mudanças que já entraram no ar
