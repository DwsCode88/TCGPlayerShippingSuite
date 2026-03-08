# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Turbopack) at localhost:3000
npm run build     # production build
npm run lint      # ESLint
npm test          # run Jest regression suite (38 tests)
npm test -- upload          # run single test file by name fragment
npm test -- --watch         # watch mode
```

## Architecture

**Next.js 15 App Router** with TypeScript and Tailwind CSS v4. Firebase client SDK is used directly in API routes (not Admin SDK — see TODO.md security items).

### Firebase Collections

| Collection | Key fields |
|---|---|
| `users/{uid}` | `easypostApiKey`, `fromAddress`, `isPro`, `plan`, `logoUrl`, package/cost settings |
| `usage/{uid}` | `count`, `month` (YYYY-MM format) — free tier label tracking |
| `batches/{batchId}` | `userId`, `createdAt`, `labelCount`, `archived` |
| `orders/{orderId}` | `userId`, `batchId`, `trackingCode`, `labelUrl`, `cost`, `createdAt` |

### API Routes

- **`/api/upload`** — batch label generation. Takes array of orders, calls EasyPost to create shipments and buy labels. Separates results into `groundAdvantage` and `envelopes` arrays.
- **`/api/single-label`** — single label for a custom address. Filters to USPS First Class or Ground Advantage rates only.
- **`/api/labels/merge`** — fetches PDF label URLs and merges them into one PDF using `pdf-lib`.
- **`/api/stripe/webhook`** — handles `checkout.session.completed` to set `isPro: true` on the matching user document.
- **`/api/export-batches`** — exports batch data as CSV.

### Shipping Logic

**Rate selection in `/api/upload`:**
- `useEnvelope: false` (high-value orders) → prefer USPS Ground Advantage; fall back to cheapest available rate
- `useEnvelope: true` → use cheapest rate (First Class envelope)

**Free tier:** Users get 10 labels/month. Checked via `usage/{uid}` doc. Pro users (`isPro === true` or `plan === "pro"`) bypass this limit. Usage is incremented after successful label creation.

**EasyPost auth:** `Basic base64(apiKey + ":")` sent as `Authorization` header on all EasyPost fetch calls.

### Key Libraries

- `firebase` (client SDK) — Auth, Firestore, Storage
- `easypost` — USPS label purchasing via REST fetch calls (not the official SDK)
- `stripe` — webhook signature verification only
- `pdf-lib` — server-side PDF merging
- `react-hot-toast` — toast notifications
- `lucide-react` — icons
- `papaparse` — installed but CSV parsing is still manual in some places (see TODO.md)

### Shared Utilities (`src/lib/`)

- `userSettings.ts` — `fetchUserSettings`, `saveUserSettings`, `UserSettings` type
- `generateOrderLabels.ts` — client-side label generation orchestration
- `generateTCGCSV.ts` — builds TCGplayer tracking upload CSV
- `saveOrder.ts` — Firestore write helpers
- `utils.ts` — misc helpers

### Auth Pattern

Client pages use `useAuthState` from `react-firebase-hooks/auth` and redirect to `/login` if unauthenticated. `SidebarLayout` wraps all authenticated dashboard pages. There is no `src/middleware.ts` auth guard (see TODO.md).

### Environment Variables

Required in `.env.local`:
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Firebase config is hardcoded in `src/firebase.ts` (public project config, not a secret).

## Test Suite

Tests live in `src/__tests__/api/` and cover all four API routes. Mocks in `src/__tests__/mocks/` provide reusable Firebase, EasyPost, and Stripe response builders. All tests mock the `@/firebase` module and global `fetch` — no real network calls.
