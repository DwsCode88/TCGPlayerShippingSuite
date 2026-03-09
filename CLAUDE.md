# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Turbopack) at localhost:3000
npm run build     # production build
npm run lint      # ESLint
npm test          # run Jest regression suite
npm test -- upload          # run single test file by name fragment
npm test -- --watch         # watch mode
```

**For local dev, start Firebase emulators first:**
```bash
firebase emulators:start --only auth,firestore
```

## Architecture

**Next.js 16 App Router** with TypeScript and Tailwind CSS v4. API routes use Hono with Firebase Admin SDK. Frontend uses Firebase client SDK.

### API Layer

All API routes are consolidated in `src/app/api/[[...route]]/route.ts` via a **Hono** router.

Auth middleware verifies `Authorization: Bearer <idToken>` on every request (except `/api/stripe/webhook`). Frontend pages call `user.getIdToken()` and pass the token in the header.

| Route | Purpose |
|---|---|
| `POST /api/labels/batch` | Batch label generation (was `/api/upload`) |
| `POST /api/labels/single` | Single label generation (was `/api/single-label`) |
| `POST /api/labels/merge` | Merges PDF label URLs via `pdf-lib` |
| `POST /api/stripe/webhook` | Handles Stripe checkout + subscription events |

### Firebase

**Server side** (`src/lib/admin.ts`): Firebase Admin SDK. Reads `FIREBASE_SERVICE_ACCOUNT_JSON` env var (base64 JSON). In local dev, set `FIRESTORE_EMULATOR_HOST=localhost:8080` and `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` instead.

**Client side** (`src/firebase.ts`): Firebase client SDK for Auth and Firestore queries in React pages.

### Firestore Collections

| Collection | Key fields |
|---|---|
| `users/{uid}` | `easypostApiKey`, `fromAddress`, `isPro`, `plan`, `stripeCustomerId`, packaging costs |
| `usage/{uid}` | `count`, `month` (YYYY-MM) — free tier label tracking |
| `batches/{batchId}` | `userId`, `createdAt`, `createdAtMillis`, `archived` |
| `orders/{orderId}` | `userId`, `batchId`, `trackingCode`, `labelUrl`, cost breakdown |

### Shipping Logic

- `useEnvelope: false` → prefer USPS Ground Advantage; fall back to cheapest rate
- `useEnvelope: true` → cheapest USPS First Class rate
- Free tier: 10 labels/month tracked in `usage/{uid}`. Pro users (`isPro === true` or `plan === "pro"`) bypass.
- EasyPost auth: `Basic base64(apiKey + ":")` header.

### Key Libraries

- `firebase-admin` — server-side Firestore/Auth in API routes
- `firebase` (client SDK) — Auth, Firestore, Storage in React pages
- `hono` + `@hono/zod-validator` — API router with Zod request validation
- `zod` — request body schemas
- `stripe` — webhook signature verification
- `pdf-lib` — server-side PDF merging
- `react-hot-toast`, `lucide-react` — UI utilities

### Auth Pattern

Client pages use `useAuthState` from `react-firebase-hooks/auth` and redirect to `/login` if unauthenticated. `SidebarLayout` wraps all authenticated dashboard pages. `src/middleware.ts` provides a best-effort cookie-based redirect for unauthenticated users.

### Environment Variables

Required in `.env.local`:
```
FIRESTORE_EMULATOR_HOST=localhost:8080        # local dev only
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099   # local dev only
FIREBASE_SERVICE_ACCOUNT_JSON=dummy          # use real base64 JSON in production
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Firebase config is hardcoded in `src/firebase.ts` (public project config, not a secret).

## Test Suite

Tests live in `src/__tests__/api/`. Mocks in `src/__tests__/mocks/` provide reusable Firebase, EasyPost, and Stripe response builders. All tests mock `@/firebase` and global `fetch` — no real network calls.
