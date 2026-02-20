# PersonalKanban

## Project Overview
A full-stack personal Kanban board app. Monorepo with a React client and Express API server. Features drag-and-drop (via @dnd-kit), voice dictation, user auth (email/password + Google OAuth), tiered billing via Stripe, categories, tags, and PostgreSQL persistence.

## Tech Stack
- **Client**: React 18, TypeScript, Vite, @dnd-kit/core + sortable, react-router-dom 7
- **Server**: Express 4, TypeScript, Prisma 6, PostgreSQL, JWT (jsonwebtoken), Passport, Stripe, Zod
- **Testing**: Playwright (E2E, client), Vitest + Supertest (unit, server)
- **Linting**: ESLint 9 with typescript-eslint

## Architecture

### Monorepo layout
- `packages/client/` — React SPA (Vite)
- `packages/server/` — Express API (Prisma + PostgreSQL)
- Root `package.json` uses npm workspaces

### Client (`packages/client/src/`)
- `App.tsx` — Routes: `/login`, `/register`, `/billing`, `/` (protected)
- `KanbanApp.tsx` — Main kanban board UI
- `api/` — Server API client (`client.ts` base fetch, `auth.ts`, `boards.ts`, `stripe.ts`)
- `contexts/` — `AuthContext` (user state, login/register/logout), `ToastContext`
- `hooks/` — `useAppState` (multi-board via API), `useBoard` (card CRUD via API), `useDragAndDrop`, `useVoiceDictation`, `useVoiceReadout`
- `components/` — Auth (LoginPage, RegisterPage, ProtectedRoute), Billing, Board, Column, Card, CardModal, Toolbar, Sidebar, CategoryManager, Toast, ImportBanner
- `utils/` — parseCardTranscript, parseVoiceCommand, colors, export, migration
- `constants/columns.ts` — Column definitions (backlog, todo, in-progress, done)
- `e2e/` — Playwright E2E tests

### Server (`packages/server/src/`)
- `routes/auth.ts` — Register, login, logout, Google OAuth, `/me`
- `routes/boards.ts` — Board and card CRUD, card reorder
- `routes/stripe.ts` — Checkout sessions, webhooks
- `middleware/` — `requireAuth` (JWT), `rateLimiter`, `errorHandler`, `ensureStripeCustomer`
- `services/` — `entitlements.ts` (tier limits), `emailService.ts` (Resend)
- `prisma/schema.prisma` — User, AccountUpgrade, Board, Card, Category models

## Key Patterns
- Board state flows: `useAppState` (fetches boards from API) → `useBoard` (card CRUD via API) → PostgreSQL
- Auth: JWT in httpOnly cookies, 7-day expiry. `ProtectedRoute` redirects to `/login` if unauthenticated.
- Voice input routes through `parseVoiceCommand` first (move commands), then falls back to `parseCardTranscript` (card creation)
- Categories are board-level managed with color assignment. Tags are free-form per card.
- Billing: three tiers (FREE/STARTER/PRO) with card limits enforced server-side. Stripe one-time checkout.
- Dev-only `window.__testInjectTranscript` hook for E2E testing voice features
- Vite proxies `/api` requests to `http://localhost:3001` in development

## Commands (run from root)
- `npm run dev` — Start both client (port 5173) and server (port 3001) concurrently
- `npm run build` — Build client for production
- `npm run lint` — ESLint (client)
- `npm test` — Run server unit tests then E2E tests
- `npm run test:server` — Server unit tests (Vitest)
- `npm run test:e2e` — Playwright E2E tests

### Server-specific (from `packages/server/`)
- `npm run dev` — Start server with tsx watch
- `npm test` — Vitest unit tests
- `npx prisma migrate dev` — Run database migrations
- `npx prisma studio` — Open Prisma database browser

## Environment
- Server env vars in `packages/server/.env` (see `.env.example`)
- Required: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`
- Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`

## Code Style
- Functional components with hooks only (no classes)
- Named exports for components, default export for App
- CSS in single `App.css` using BEM-like naming (e.g., `kanban-card__title`, `modal__field`)
- CSS custom properties for theming (dark theme default)
