# Plan: Stripe Payments + User Auth for PersonalKanban

## Context
PersonalKanban is currently a pure client-side React/Vite/TypeScript SPA — no backend, no auth, all data in localStorage. The goal is to add:
- User accounts (email/password + Google OAuth) so payments can be tied to an identity
- A PostgreSQL-backed Express server to store boards/cards and payment records
- Stripe one-time payments to unlock higher card limits per board
- A billing page in the frontend

**Pricing tiers (per board, replacement not additive):**
| Tier | Cards | Price |
|------|-------|-------|
| Free | 10 | $0 |
| Starter | 50 total | $5 one-time |
| Pro | 100 total | $10 one-time |

No refunds in scope.

---

## Architecture Overview

The project becomes a **monorepo with two packages**:
- `packages/client/` — existing Vite React app (moved from root)
- `packages/server/` — new Express + TypeScript backend

Data moves from localStorage → PostgreSQL (Prisma ORM). Auth uses **JWT in httpOnly cookies** (XSS-safe, no session store needed, 7-day TTL). Stripe uses hosted Checkout with webhooks to confirm payments.

---

## Phase 1 — Monorepo Setup

### Files to create / modify:
| Path | Action |
|------|--------|
| `package.json` (root) | MODIFY — add `"workspaces": ["packages/client", "packages/server"]`, concurrently dev script |
| `packages/client/` | MOVE — all existing `src/`, `public/`, `package.json`, `vite.config.ts` etc. here |
| `packages/client/vite.config.ts` | MODIFY — add `server.proxy` to forward `/api` → `http://localhost:3001` |
| `packages/server/package.json` | CREATE |
| `packages/server/tsconfig.json` | CREATE — CommonJS target, strict |
| `packages/server/src/index.ts` | CREATE — Express entry point |
| `packages/server/src/config.ts` | CREATE — typed env vars via zod |
| `packages/server/src/db.ts` | CREATE — Prisma client singleton |

### Key server dependencies:
```
express, @prisma/client, bcryptjs, jsonwebtoken, cookie-parser, cors,
passport, passport-local, passport-google-oauth20, stripe, zod, uuid
```

### Dev script (root):
```
npm run dev → concurrently "tsx watch packages/server/src/index.ts" "vite (in packages/client)"
```
Servers: frontend on `:5173`, backend on `:3001`. Vite proxy means no CORS config needed.

---

## Phase 2 — PostgreSQL Schema (Prisma)

**File:** `packages/server/prisma/schema.prisma`

```prisma
model User {
  id           String  @id @default(uuid())
  email        String  @unique
  passwordHash String?        // null for Google-only accounts
  googleId     String? @unique
  displayName  String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  boards       Board[]
  upgrades     BoardUpgrade[]
}

model Board {
  id        String   @id @default(uuid())
  userId    String
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(...)
  cards     Card[]
  categories Category[]
  upgrades  BoardUpgrade[]
}

model Card {
  id          String   @id @default(uuid())
  boardId     String
  title       String
  description String   @default("")
  category    String   @default("")
  priority    String   @default("medium")   // low|medium|high|urgent
  dueDate     DateTime?
  tags        String[]                       // Postgres array
  columnId    String                         // backlog|todo|in-progress|done
  order       Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  board       Board    @relation(...)
}

model Category {
  id      String @id @default(uuid())
  boardId String
  name    String
  color   String
  board   Board  @relation(...)
  @@unique([boardId, name])
}

model BoardUpgrade {
  id                    String   @id @default(uuid())
  boardId               String
  userId                String
  tier                  String   // "starter" | "pro"
  stripeSessionId       String?  @unique
  stripePaymentIntentId String?  @unique
  amountCents           Int
  purchasedAt           DateTime @default(now())
  board Board @relation(...)
  user  User  @relation(...)
}
```

**Tier limit constants** in `packages/server/src/config.ts`:
```typescript
export const TIER_LIMITS = { free: 10, starter: 50, pro: 100 } as const;
```

Effective tier for a board = `MAX(amountCents)` across all `BoardUpgrade` rows (buying Pro after Starter just works; no downgrades).

---

## Phase 3 — Auth (Express + JWT + Google OAuth)

### New files:
| Path | Purpose |
|------|---------|
| `packages/server/src/middleware/auth.ts` | `requireAuth` middleware — verifies JWT cookie, attaches `req.user` |
| `packages/server/src/routes/auth.ts` | All auth endpoints |
| `packages/client/src/contexts/AuthContext.tsx` | `AuthProvider` + `useAuth` hook |
| `packages/client/src/components/Auth/LoginPage.tsx` | Login form |
| `packages/client/src/components/Auth/RegisterPage.tsx` | Register form |
| `packages/client/src/components/Auth/ProtectedRoute.tsx` | Redirects to `/login` if unauthenticated |

### Auth endpoints:
```
POST /api/auth/register       { email, password, displayName } → sets JWT cookie
POST /api/auth/login          { email, password } → sets JWT cookie
POST /api/auth/logout         clears JWT cookie
GET  /api/auth/me             returns current user (used on page load to restore session)
GET  /api/auth/google         → Google OAuth redirect
GET  /api/auth/google/callback → sets JWT cookie, redirects to /
```

### JWT cookie config:
```typescript
{ httpOnly: true, sameSite: 'strict', secure: true (prod only), maxAge: 7d }
```

### Google OAuth account linking:
If a Google email already exists as a local account, the `googleId` is linked to it rather than creating a duplicate.

---

## Phase 4 — Board & Card API

### New files:
| Path | Purpose |
|------|---------|
| `packages/server/src/routes/boards.ts` | Board CRUD + card CRUD + reorder + entitlement |
| `packages/server/src/routes/cards.ts` | (or inline in boards.ts) |

### Endpoints (all require `requireAuth`):
```
GET    /api/boards                           list user's boards
POST   /api/boards                           create board
GET    /api/boards/:id                       get board with cards + categories
PATCH  /api/boards/:id                       update title
DELETE /api/boards/:id                       delete board

POST   /api/boards/:id/cards                 add card — enforces limit
PATCH  /api/boards/:id/cards/:cardId         update card
DELETE /api/boards/:id/cards/:cardId         delete card
POST   /api/boards/:id/cards/reorder         batch update order+columnId after drag

GET    /api/boards/:id/entitlement           { tier, cardLimit, cardCount }

POST   /api/boards/import                    one-time localStorage migration
```

### Server-side card limit enforcement (critical):
```typescript
// In POST /api/boards/:id/cards
const cardCount = await prisma.card.count({ where: { boardId } });
const limit = await getBoardLimit(boardId); // checks BoardUpgrade table
if (cardCount >= limit) {
  return res.status(403).json({
    error: 'Card limit reached',
    code: 'CARD_LIMIT_EXCEEDED',
    limit,
    current: cardCount,
  });
}
```

### Drag-and-drop reorder:
Runs a Prisma `$transaction` to batch-update `order` + `columnId` for all affected cards. Called after every drag-drop completion.

---

## Phase 5 — Stripe Integration

### Stripe products to create in dashboard:
- "Board Starter" — $5.00 USD, `mode: 'payment'` (one-time)
- "Board Pro" — $10.00 USD, `mode: 'payment'` (one-time)

Store `STRIPE_STARTER_PRICE_ID` and `STRIPE_PRO_PRICE_ID` in `.env`.

### New file: `packages/server/src/routes/stripe.ts`

```
POST /api/stripe/create-checkout-session   (requireAuth)
POST /api/stripe/webhook                   (NO auth — raw body required)
```

### Checkout session creation:
```typescript
stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${CLIENT_URL}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
  cancel_url:  `${CLIENT_URL}/billing?status=cancelled`,
  metadata: { boardId, userId, tier },  // ← critical for webhook fulfillment
})
// Return { sessionUrl } → frontend does window.location.href = sessionUrl
```

### Webhook handler pattern:
```typescript
// Must be registered BEFORE express.json() middleware
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// In handler:
const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
if (event.type === 'checkout.session.completed') {
  const { boardId, userId, tier } = session.metadata;
  // Idempotency: skip if stripeSessionId already in BoardUpgrade
  await prisma.boardUpgrade.create({ data: { boardId, userId, tier, ... } });
}
res.json({ received: true }); // always 200 to Stripe
```

### Webhook testing (dev):
```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
# Prints whsec_... → put in .env as STRIPE_WEBHOOK_SECRET
```

---

## Phase 6 — Frontend: Routing + API Layer + Hook Refactor

### New files:
| Path | Purpose |
|------|---------|
| `packages/client/src/api/client.ts` | Fetch wrapper: handles cookies, 401→redirect, JSON errors |
| `packages/client/src/api/auth.ts` | Auth API calls |
| `packages/client/src/api/boards.ts` | Board API calls |
| `packages/client/src/api/stripe.ts` | Stripe checkout call |

### Files to modify:
| Path | Change |
|------|--------|
| `packages/client/package.json` | Add `react-router-dom` |
| `packages/client/src/App.tsx` | Becomes routing shell with `AuthProvider` + `<Routes>` |
| `packages/client/src/KanbanApp.tsx` | NEW — extracted from App.tsx; existing board UI |
| `packages/client/src/hooks/useAppState.ts` | Async API-driven (replace local state with fetch) |
| `packages/client/src/hooks/useBoard.ts` | Async API calls; `addCard` returns `{ error? }` |
| `packages/client/src/hooks/usePersistence.ts` | **DELETE** — replaced by API layer |
| `packages/client/src/utils/migration.ts` | Keep only for localStorage import helper |

### Route structure:
```
/login       → LoginPage (public)
/register    → RegisterPage (public)
/            → KanbanApp (protected)
/billing     → BillingPage (protected)
*            → redirect to /
```

### API client pattern:
```typescript
// credentials: 'include' sends httpOnly cookies automatically
const res = await fetch(`/api${path}`, { credentials: 'include', ... });
if (res.status === 401) { window.location.href = '/login'; }
```

### Hook strategy — optimistic vs awaited:
- **Drag-and-drop / edits**: optimistic update (instant UI, sync in background)
- **Add card**: await server response first (server may reject with limit error)

---

## Phase 7 — Billing Page + Card Limit UI

### New file: `packages/client/src/components/Billing/BillingPage.tsx`

Displays for the **active board**:
- Current tier + card count (fetches `GET /api/boards/:id/entitlement`)
- Plan cards showing Free / Starter / Pro options
- "Upgrade" button calls `POST /api/stripe/create-checkout-session` → redirects to Stripe
- On return from Stripe (`?status=success`), refreshes entitlement and shows success message
- Pro tier button is disabled if already on Pro

### Sidebar card limit indicator:
Modify `packages/client/src/components/Sidebar/Sidebar.tsx`:
```tsx
// Replace simple card count with:
<span className="sidebar__item-count">
  {board.cards.length} / {limit}
</span>
// Add "Upgrade" badge when ≥ 90% full
```

### CardModal limit error handling:
Modify `packages/client/src/components/CardModal/CardModal.tsx`:
- `onSave` prop changes: `Promise<{ error?: string } | void>`
- On `CARD_LIMIT_EXCEEDED` error, show inline message with link to `/billing`
- Modal stays open so user can navigate to billing

### Toolbar user menu:
Modify `packages/client/src/components/Toolbar/Toolbar.tsx`:
- Add user display name + logout button
- Add "Billing" button/link

---

## Phase 7b — Card Limit Notifications

Users are notified through **three escalating layers**:

### 1. Proactive warning — sidebar indicator (already in Phase 7)
When a board is ≥ 90% full, the `{cards}/{limit}` count in the Sidebar turns amber and shows an "Upgrade" badge. This is passive — visible at all times.

### 2. In-app toast — at the moment the limit is hit
New component: `packages/client/src/components/Notifications/Toast.tsx`

A global toast system renders in `App.tsx` (outside the routing shell). When `addCard` returns `CARD_LIMIT_EXCEEDED`, a toast slides in from the top-right:

```
┌─────────────────────────────────────────────┐
│ ⚠  You've reached your card limit (10/10)   │
│    Upgrade this board to add more cards.     │
│    [ Upgrade Board → ]              [ ✕ ]   │
└─────────────────────────────────────────────┘
```

- Auto-dismisses after 8 seconds
- "Upgrade Board →" is a link to `/billing`
- Dismissable manually with ✕
- Uses existing CSS custom properties (`--neon-purple`, `--bg-secondary`, glassmorphism)

**Implementation:**
```typescript
// packages/client/src/contexts/ToastContext.tsx (new)
// Provides: useToast() → { showToast(message, action?) }
// Renders: <ToastContainer /> floated in App.tsx

// In useBoard.ts addCard error handler:
if (err.code === 'CARD_LIMIT_EXCEEDED') {
  showToast(`Card limit reached (${err.current}/${err.limit})`, {
    label: 'Upgrade Board',
    href: '/billing',
  });
}
```

### 3. Email notification — when limit is first hit
When the webhook confirms a limit is reached OR when the first `CARD_LIMIT_EXCEEDED` 403 is returned, the server sends a one-time email to the user.

**New server dependency:** `resend` (Resend.com — free tier: 3,000 emails/month)

```typescript
// packages/server/src/services/emailService.ts (new)
import { Resend } from 'resend';
const resend = new Resend(config.RESEND_API_KEY);

export async function sendCardLimitEmail(userEmail: string, boardTitle: string, tier: string) {
  await resend.emails.send({
    from: 'noreply@yourdomain.com',
    to: userEmail,
    subject: `You've hit your card limit on "${boardTitle}"`,
    html: `
      <p>You've reached the ${tier} plan limit on your board <strong>${boardTitle}</strong>.</p>
      <p>Upgrade to add more cards: <a href="${config.CLIENT_URL}/billing">Upgrade now</a></p>
    `,
  });
}
```

Email is sent **once per board per tier** — tracked via a boolean `limitEmailSentAt` on `BoardUpgrade` (or a separate `BoardNotification` record) to prevent repeat emails on every failed add.

**New env var:** `RESEND_API_KEY=re_...` in `packages/server/.env`

### New files for notifications:
| Path | Purpose |
|------|---------|
| `packages/client/src/contexts/ToastContext.tsx` | Global toast state + `useToast` hook |
| `packages/client/src/components/Notifications/Toast.tsx` | Toast UI component |
| `packages/server/src/services/emailService.ts` | Resend email service |

### Modified files:
| Path | Change |
|------|--------|
| `packages/client/src/App.tsx` | Add `<ToastProvider>` + `<ToastContainer>` |
| `packages/client/src/hooks/useBoard.ts` | Call `showToast` on `CARD_LIMIT_EXCEEDED` |
| `packages/server/src/routes/boards.ts` | Call `sendCardLimitEmail` on first limit hit |
| `packages/server/src/config.ts` | Add `RESEND_API_KEY` env var |

---

## Phase 8 — localStorage Data Migration

### One-time import flow:
1. After login, frontend checks `localStorage.getItem('personal-kanban-app')`
2. If data exists AND user has 0 boards on server → show banner: "Import your existing boards?"
3. `POST /api/boards/import` with raw AppState JSON
4. Server creates all boards + cards + categories in DB
5. Frontend clears localStorage on success

---

## Phase 9 — Testing Strategy

### Overview: Three-layer approach

| Layer | Tool | Purpose |
|-------|------|---------|
| Backend unit/integration | **Vitest + supertest** | Route logic, card limit enforcement, webhook handler |
| E2E (automated CI) | **Playwright** (updated) | Full user flows with real browser + real server |
| Interactive AI verification | **agent-browser** (Vercel Labs) | Developer spot-checks during build; NOT a test framework |

---

### Layer 1 — Backend Tests (Vitest + supertest)

**New devDependencies for `packages/server`:**
```
vitest, supertest, @types/supertest
```

**Test isolation — transaction rollback per test:**

Rather than a separate DB, each test wraps its DB operations using a truncate-after approach (the practical equivalent of rollback — connection pool limitations make true per-test transactions complex with Prisma):

```typescript
// packages/server/src/__tests__/setup.ts
import { prisma } from '../db';

afterEach(async () => {
  // Truncate in dependency order (cards before boards before users)
  await prisma.$executeRaw`TRUNCATE "BoardUpgrade", "Card", "Category", "Board", "User" CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**New test files:**

| Path | What it tests |
|------|---------------|
| `packages/server/src/__tests__/auth.test.ts` | Register, login, logout, `/me`, duplicate email, wrong password |
| `packages/server/src/__tests__/boards.test.ts` | CRUD, ownership check (can't access another user's board), card limit at 10/50/100 |
| `packages/server/src/__tests__/webhook.test.ts` | Webhook handler with mocked Stripe events, idempotency (same session twice = one record) |

**Card limit test pattern:**
```typescript
// boards.test.ts
it('blocks the 11th card on a free board', async () => {
  // Seed 10 cards directly via prisma
  await prisma.card.createMany({ data: Array.from({ length: 10 }, (_, i) => ({
    boardId, title: `Card ${i}`, columnId: 'backlog', order: i, ...defaults
  }))});

  const res = await request(app)
    .post(`/api/boards/${boardId}/cards`)
    .set('Cookie', authCookie)
    .send({ title: 'Card 11', columnId: 'backlog' });

  expect(res.status).toBe(403);
  expect(res.body.code).toBe('CARD_LIMIT_EXCEEDED');
});
```

**Mocked Stripe webhook test pattern:**
```typescript
// webhook.test.ts — no real Stripe calls needed
import Stripe from 'stripe';
import { vi } from 'vitest';

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          amount_total: 500,
          metadata: { boardId, userId, tier: 'starter' },
        }},
      }),
    },
  })),
}));

it('creates BoardUpgrade on checkout.session.completed', async () => {
  const res = await request(app)
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'mock-sig')
    .send(Buffer.from('{}'));

  expect(res.status).toBe(200);
  const upgrade = await prisma.boardUpgrade.findFirst({ where: { stripeSessionId: 'cs_test_123' } });
  expect(upgrade?.tier).toBe('starter');
});

it('is idempotent — same session processed twice creates only one record', async () => {
  // Call webhook twice with same session ID
  await request(app).post('/api/stripe/webhook').set('stripe-signature', 'mock-sig').send(Buffer.from('{}'));
  await request(app).post('/api/stripe/webhook').set('stripe-signature', 'mock-sig').send(Buffer.from('{}'));

  const count = await prisma.boardUpgrade.count({ where: { stripeSessionId: 'cs_test_123' } });
  expect(count).toBe(1);
});
```

**Run command:** `npm run test` in `packages/server` → `vitest run`

---

### Layer 2 — Playwright E2E Tests (updated)

**Existing tests to update** (currently use `localStorage.clear()` for state reset — must change to server-side reset):

```typescript
// New shared helper: packages/client/e2e/helpers/auth.ts
export async function registerAndLogin(page: Page, email = 'test@example.com') {
  await page.request.post('/api/auth/register', {
    data: { email, password: 'password123', displayName: 'Test User' },
  });
  // JWT cookie is set automatically in the browser context
}

export async function resetTestUser(page: Page) {
  // Delete user (cascades to all boards/cards) then re-register
  await page.request.delete('/api/test/reset'); // dev-only endpoint
}
```

**Dev-only test reset endpoint** in Express (behind `NODE_ENV === 'test'` guard):
```typescript
// Deletes all data for the test email — used by Playwright beforeEach
app.delete('/api/test/reset', async (req, res) => {
  if (config.NODE_ENV !== 'test') { res.status(404).end(); return; }
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.example' } } });
  res.json({ ok: true });
});
```

**Updated test structure** (`beforeEach` in each spec file):
```typescript
test.beforeEach(async ({ page }) => {
  await resetTestUser(page);
  await registerAndLogin(page);
  await page.goto('/');
});
```

**New E2E test files:**

| File | What it tests |
|------|---------------|
| `e2e/auth.spec.ts` | Register, login, logout, redirect to `/login` when unauthenticated, Google OAuth button visible |
| `e2e/card-limits.spec.ts` | Free board blocks card 11 with error banner + billing link; Starter allows 50; Pro allows 100 |
| `e2e/billing.spec.ts` | Billing page shows current tier; Upgrade button present; `?status=success` shows success message; Pro disables further upgrade button |

**Existing specs that need auth added** (otherwise unchanged):
- `board-defaults.spec.ts` — add `beforeEach` auth helper
- `dictation-flow.spec.ts` — add `beforeEach` auth helper
- `voice-move.spec.ts` — add `beforeEach` auth helper
- `tags.spec.ts` — add `beforeEach` auth helper

**Playwright config update** (`playwright.config.ts`):
```typescript
// Add baseURL and start both dev servers
webServer: [
  { command: 'npm run dev -w packages/server', port: 3001, reuseExistingServer: true },
  { command: 'npm run dev -w packages/client', port: 5173, reuseExistingServer: true },
],
use: {
  baseURL: 'http://localhost:5173',
},
```

**Run command:** `npm run test:e2e` from root (unchanged command, updated config)

---

### Layer 3 — agent-browser (Vercel Labs) — Interactive Dev Verification

**What it is:** A headless browser CLI (`agent-browser`) built by Vercel Labs specifically for AI agents. It is NOT a test framework — it has no assertions, no `describe`/`it`, no CI output. Instead, it lets Claude Code navigate a live browser interactively during development to spot-check a UI.

**How it fits here:** The `ralph-loop` skill already installed uses this pattern. During development, rather than manually opening a browser, I (Claude Code) can run:
```bash
agent-browser open http://localhost:5173
agent-browser snapshot -i          # → shows @e1, @e2 etc. for interactive elements
agent-browser click @e1            # → clicks a button
agent-browser fill @e2 "test@..."  # → fills a form field
```

This is used for **quick developer spot-checks** — e.g. verifying the billing page renders, the card limit error shows correctly — without replacing the automated test suite.

**It is NOT a replacement for Playwright.** Playwright runs in CI, runs unattended, has assertions, and produces pass/fail reports. agent-browser is a developer tool for AI-assisted interactive verification.

---

### Updated `packages/server/package.json` test scripts:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

### Updated root `package.json` test scripts:
```json
"scripts": {
  "test:server": "npm run test -w packages/server",
  "test:e2e": "playwright test",
  "test": "npm run test:server && npm run test:e2e"
}
```

---

### `packages/server/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/personal_kanban
JWT_SECRET=<64-char random string>
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```

### `packages/client/.env`:
```
VITE_GOOGLE_OAUTH_ENABLED=true
```

The client never holds any Stripe or JWT secrets.

---

## Dev Setup Commands

```bash
# 1. Start PostgreSQL
docker run -e POSTGRES_PASSWORD=password -e POSTGRES_DB=personal_kanban -p 5432:5432 postgres:16

# 2. Run Prisma migration
cd packages/server && npx prisma migrate dev --name init

# 3. Start everything
npm run dev   # from root — starts both servers via concurrently

# 4. Stripe webhook forwarding (separate terminal)
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

---

## Acceptance Criteria

### Authentication
- [ ] User can register with email, password, and display name
- [ ] Duplicate email registration returns a clear error
- [ ] User can log in with correct credentials
- [ ] Wrong password returns "Invalid credentials" (not which field was wrong)
- [ ] Logged-in user sees their display name in the Toolbar
- [ ] Logout clears the session and redirects to `/login`
- [ ] Visiting `/` while logged out redirects to `/login`
- [ ] Visiting `/login` while logged in redirects to `/`
- [ ] Page reload restores the session (JWT cookie persists, `/api/auth/me` is called on load)
- [ ] "Sign in with Google" button is visible on the login page
- [ ] Google OAuth creates a new account if the email doesn't exist
- [ ] Google OAuth links to an existing email/password account if the email matches

### Boards & Cards (server-backed)
- [ ] User can create a new board
- [ ] User can rename a board
- [ ] User can delete a board (except the last one)
- [ ] Boards are scoped to the logged-in user — another user cannot access them
- [ ] All cards, categories, and drag-drop order persist across page reloads
- [ ] Drag-and-drop reorder is reflected in the database after drop
- [ ] Existing localStorage boards can be imported after first login via the import banner

### Card Limits — Free Tier (10 cards)
- [ ] A new board starts with a 10-card limit
- [ ] The Sidebar shows `{count} / 10` for a free board
- [ ] Adding the 11th card is blocked — the server returns 403 with `code: CARD_LIMIT_EXCEEDED`
- [ ] A toast notification appears explaining the limit has been reached
- [ ] The toast contains a working "Upgrade Board" link to `/billing`
- [ ] The CardModal stays open and shows an inline error message when the limit is hit
- [ ] The Sidebar shows an amber "Upgrade" badge when a board is ≥ 90% full (9+ of 10 cards)
- [ ] A one-time limit-reached email is sent to the user's registered email address

### Billing Page
- [ ] `/billing` is accessible from the Toolbar and the Sidebar upgrade badge
- [ ] Billing page shows the active board's current tier (Free / Starter / Pro)
- [ ] Billing page shows the current card count and limit for the active board
- [ ] Three plan options are displayed: Free (10), Starter ($5 / 50), Pro ($10 / 100)
- [ ] The current tier's plan card is visually highlighted / marked as "Current"
- [ ] The "Upgrade" button for a lower or equal tier is disabled if already on a higher tier
- [ ] Clicking "Upgrade to Starter" redirects to Stripe hosted checkout
- [ ] Clicking "Upgrade to Pro" redirects to Stripe hosted checkout
- [ ] Returning from Stripe with `?status=success` shows a success confirmation message
- [ ] Returning from Stripe with `?status=cancelled` shows a cancellation message (no charge)

### Stripe Payments & Webhooks
- [ ] Checkout session is created server-side with correct `metadata` (`boardId`, `userId`, `tier`)
- [ ] Test card `4242 4242 4242 4242` completes payment in Stripe test mode
- [ ] `checkout.session.completed` webhook creates a `BoardUpgrade` row in the database
- [ ] Sending the same webhook event twice does NOT create a duplicate `BoardUpgrade` (idempotency)
- [ ] After payment, the board's card limit updates to 50 (Starter) or 100 (Pro)
- [ ] Buying Pro after Starter correctly applies the higher limit (no downgrade)
- [ ] Sidebar card count updates to show the new limit (e.g., `3 / 50`) after upgrade

### Notifications
- [ ] Toast notification appears immediately when the 11th card is attempted
- [ ] Toast auto-dismisses after 8 seconds
- [ ] Toast can be dismissed manually with the ✕ button
- [ ] Limit-reached email is sent exactly once per board (not on every failed attempt)
- [ ] Email contains a working link to the billing page

### Testing
- [ ] `npm run test:server` passes all backend unit/integration tests
- [ ] Webhook test confirms idempotency (same session → one `BoardUpgrade` record)
- [ ] Card limit test confirms 403 is returned on the 11th card for a free board
- [ ] `npm run test:e2e` passes all Playwright tests including new auth + billing + limits specs
- [ ] All existing E2E tests (board-defaults, dictation, voice-move, tags) still pass with auth added

---

## Complete New File List

```
# Root
package.json                          MODIFY

# Server (all new)
packages/server/package.json
packages/server/tsconfig.json
packages/server/.env.example
packages/server/prisma/schema.prisma
packages/server/src/index.ts
packages/server/src/config.ts
packages/server/src/db.ts
packages/server/src/middleware/auth.ts
packages/server/src/middleware/errorHandler.ts
packages/server/src/routes/auth.ts
packages/server/src/routes/boards.ts
packages/server/src/routes/stripe.ts

# Client — new files
packages/client/src/api/client.ts
packages/client/src/api/auth.ts
packages/client/src/api/boards.ts
packages/client/src/api/stripe.ts
packages/client/src/contexts/AuthContext.tsx
packages/client/src/KanbanApp.tsx
packages/client/src/components/Auth/LoginPage.tsx
packages/client/src/components/Auth/RegisterPage.tsx
packages/client/src/components/Auth/ProtectedRoute.tsx
packages/client/src/components/Billing/BillingPage.tsx

# Client — modified files
packages/client/package.json          add react-router-dom
packages/client/vite.config.ts        add /api proxy
packages/client/src/App.tsx           routing shell
packages/client/src/hooks/useAppState.ts      async/API-driven
packages/client/src/hooks/useBoard.ts         async/API-driven
packages/client/src/hooks/usePersistence.ts   DELETE
packages/client/src/types/index.ts            add Entitlement, AuthUser
packages/client/src/components/Sidebar/Sidebar.tsx    limit indicator
packages/client/src/components/Toolbar/Toolbar.tsx    user menu + billing link
packages/client/src/components/CardModal/CardModal.tsx  async onSave + error UI

# Notification files (new)
packages/client/src/contexts/ToastContext.tsx
packages/client/src/components/Notifications/Toast.tsx
packages/server/src/services/emailService.ts

# Server tests (all new)
packages/server/src/__tests__/setup.ts
packages/server/src/__tests__/auth.test.ts
packages/server/src/__tests__/boards.test.ts
packages/server/src/__tests__/webhook.test.ts

# E2E tests
e2e/helpers/auth.ts                   NEW — shared auth helpers
e2e/auth.spec.ts                      NEW
e2e/card-limits.spec.ts               NEW
e2e/billing.spec.ts                   NEW
e2e/board-defaults.spec.ts            MODIFY — add beforeEach auth
e2e/dictation-flow.spec.ts            MODIFY — add beforeEach auth
e2e/voice-move.spec.ts                MODIFY — add beforeEach auth
e2e/tags.spec.ts                      MODIFY — add beforeEach auth
playwright.config.ts                  MODIFY — dual webServer, baseURL
```

---

## Model

This plan should be executed using **claude-opus-4-6**. To switch before implementation begins, run `/model` and select Opus 4.6, or set in `~/.claude/settings.json`:
```json
{ "model": "claude-opus-4-6" }
```

---

*Sources consulted: [React Stripe.js reference](https://docs.stripe.com/sdks/stripejs-react) · [Stripe Checkout + Vercel](https://divjoy.com/guide/react-stripe-vercel) · [Serverless Stripe on Jamstack (freeCodeCamp)](https://www.freecodecamp.org/news/serverless-online-payments/) · [Stripe + Netlify Functions](https://divjoy.com/guide/react-stripe-netlify)*
