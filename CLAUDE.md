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

## Working with Lovable

This project is co-developed with **Lovable** (lovable.dev), an AI-powered dev environment that has direct access to deploy Supabase Edge Functions, run migrations, and sync the Supabase project.

### What requires Lovable

Some actions cannot be done via Claude Code alone and must be executed through the Lovable chat interface:

- **Deploying Edge Functions** — Lovable deploys them directly to the Supabase project. Editing files locally has no effect until Lovable redeploys.
- **Running database migrations** — Lovable applies `.sql` migration files to the live Supabase instance.
- **Updating `src/integrations/supabase/types.ts`** — Lovable regenerates this file after schema changes.

### How to handle this

Whenever a task requires one of the above actions, **provide a ready-to-paste Lovable prompt** at the end of the response, formatted like this:

---
**Lovable input:**
```
<prompt in Portuguese describing exactly what to implement or deploy>
```
---

The prompt should be self-contained and precise — include field names, function names, or SQL snippets as needed so the user can paste it directly without editing.
