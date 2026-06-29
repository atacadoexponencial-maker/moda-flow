# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

To run a single test file:
```bash
npx vitest run src/test/example.test.ts
```

E2E tests use Playwright (`playwright.config.ts`).

## Architecture

**moda-flow** is a CRM/lead management system for sales pipelines, built with React + TypeScript + Vite and backed by Supabase.

### Routing & Layout

`App.tsx` defines all routes via React Router v6. Unauthenticated users see `LoginPage`. Authenticated routes are wrapped in `AppLayout` (sidebar + header). Key routes: `/pipeline`, `/leads`, `/hoje`, `/dashboard`, `/configuracoes/*`.

### State Management

- **Server state**: TanStack React Query for all Supabase data fetching, caching, and mutations.
- **Auth state**: `src/hooks/useAuth.tsx` subscribes to Supabase auth changes.
- **UI state**: Local `useState` only — no global state library.

### Backend (Supabase)

- **Database**: PostgreSQL with RLS. Main tables: `leads`, `activities`, `funnel_campaigns`.
- **Edge Functions** (`supabase/functions/`): serverless handlers for Meta Ads OAuth/insights, CSV import, user management, and lead webhooks.
- **Types**: `src/integrations/supabase/types.ts` is auto-generated from the schema — do not edit manually.
- **Migrations**: `supabase/migrations/` — add new `.sql` files for schema changes.

### Key Directories

- `src/pages/` — page-level routed components
- `src/components/ui/` — shadcn/ui primitives (do not modify generated components)
- `src/components/pipeline/`, `dashboard/`, `leads/` — feature-specific components
- `src/lib/` — shared utilities and constants (funnel stages, filter logic, dashboard calculations)
- `src/integrations/supabase/` — Supabase client and auto-generated types

### UI

Components use **shadcn/ui** (Radix UI + Tailwind CSS). The pipeline page uses **@dnd-kit** for drag-and-drop. Charts use **Recharts**. Forms use **React Hook Form + Zod**.

The UI is in **Portuguese (pt-BR)**.

## Deploy

The frontend is deployed to **Vercel** (production builds from `origin/main`). The backend stays on **Supabase** (database + Edge Functions), managed via the **Supabase CLI**.

> This project was previously co-developed with Lovable. That migration is complete — do **not** generate "Lovable input" prompts anymore.

### Deploying backend changes (Supabase CLI)

The project is linked to the Supabase project `ynjxvzjomizfyabupvne` (see `supabase/config.toml`).

- **Edge Functions** (`supabase/functions/`): editing files locally has no effect until deployed.
  ```bash
  supabase functions deploy <function-name>   # or omit name to deploy all
  ```
  Functions with `verify_jwt = false` (e.g. `webhook-lead`, the `meta-*` handlers) are configured in `supabase/config.toml`.
- **Migrations** (`supabase/migrations/`): add a new `.sql` file, then apply it to the live instance.
  ```bash
  supabase db push
  ```
- **Generated types** (`src/integrations/supabase/types.ts`): regenerate after schema changes.
  ```bash
  supabase gen types typescript --project-id ynjxvzjomizfyabupvne > src/integrations/supabase/types.ts
  ```

### Deploying the frontend (Vercel)

Pushing to `origin/main` triggers a production deploy on Vercel. Local work happens on `master`, so carry commits over to `main` before expecting them in production.
