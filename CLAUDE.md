# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server with Turbopack at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

There are no automated tests in this project.

## Architecture Overview

**TCG Shipping Suite** is a Next.js 15 (App Router) SaaS tool for TCGplayer sellers to generate USPS shipping labels in bulk via the EasyPost API.

### Auth & Data

- Firebase Auth (Google/email) via `react-firebase-hooks`
- Firestore collections:
  - `users/{uid}` — user settings (EasyPost API key, from address, packaging costs, plan status)
  - `batches/{batchId}` — batch metadata (name, timestamps, archived flag, notes)
  - `orders/{orderId}` — individual orders with tracking codes, label URLs, cost breakdown
  - `usage/{uid}` — monthly label count for free-tier enforcement (10 labels/month)
- Firebase client is initialized in `src/firebase.ts` and exported as `{ auth, db, storage }`
- `src/firebaseUtils.ts` is an **older/duplicate** file — prefer `src/lib/userSettings.ts` for user settings operations

### API Routes (`src/app/api/`)

All routes are Next.js Route Handlers (not Pages API). Key routes:

| Route | Purpose |
|---|---|
| `POST /api/upload` | Batch label generation — creates EasyPost shipments for all orders, saves to Firestore |
| `POST /api/single-label` | Single label generation — same flow for one order |
| `POST /api/labels/merge` | Fetches PDFs from EasyPost URLs and merges them via `pdf-lib` |
| `POST /api/stripe/webhook` | Handles `checkout.session.completed` → sets `isPro: true` on user doc |
| `POST /api/stripe/create-customer` | Creates Stripe customer |
| `GET /api/export-batches` | Exports batch data |

**EasyPost integration pattern** (in both upload and single-label routes):
1. Fetch user settings + API key from Firestore
2. Check free-tier usage limit
3. POST to `https://api.easypost.com/v2/shipments` to get rates
4. POST to `/buy` with the selected rate
5. Save order to Firestore with tracking code and label URL

**Pro plan check**: `isPro === true || plan === "pro"` on the user document. Free users get 10 labels/month tracked in `usage/{uid}`.

### Shipping Logic

- Orders with `valueOfProducts >= valueThreshold` → USPS Ground Advantage (box/parcel)
- Orders below threshold → USPS First Class Letter (envelope/PWE)
- Orders with `itemCount >= cardCountThreshold` → marked `nonMachinable`
- Both thresholds come from user settings (defaults: value=$25, card count=8)
- Label separation (envelope vs ground) is determined by `useEnvelope` boolean on each order

### Frontend Pages

- `/` — Landing page, redirects authenticated users to `/dashboard`
- `/upload` — Main CSV upload flow: parse TCGplayer export CSV → preview order table → generate labels
- `/dashboard` — Stats overview (batch count, label count, postage total) + recent batches
- `/dashboard/batch/[batchId]` — Batch detail with cost breakdown, CSV export, PDF label download
- `/dashboard/history` — Full batch list
- `/dashboard/settings` — User settings form (`src/components/SettingsForm.tsx`)
- `/dashboard/billing` — Stripe billing
- `/dashboard/single-label` — One-off label creation UI
- `/admin` — Admin-only stats and user management

### Key Libraries

- `src/lib/generateOrderLabels.ts` — Generates 2"×1.25" packing slip PDFs with order numbers (client-side, uses `document`)
- `src/lib/generateLabelWithLogo.ts` — Label generation with logo overlay
- `src/lib/generateTCGCSV.ts` — Generates TCGplayer tracking upload CSV (Tracking #, Order #, Carrier)
- `src/lib/saveOrder.ts` — Firestore order persistence helpers

### Layout

All authenticated pages wrap content in `<SidebarLayout>` (`src/components/SidebarLayout.tsx`), which provides the sidebar nav. Auth guard is done manually in each page via `useAuthState` + `router.push("/login")` — there is no centralized middleware.

### Environment Variables

Required (not committed):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

The Firebase config is **hardcoded** in `src/firebase.ts` (public-facing config values only — Firebase security is enforced via Firestore/Storage rules).

### CSV Parsing

The upload page does manual CSV parsing (no Papa Parse despite it being installed). It expects files named `TCGplayer_ShippingExport_*` and uses header index matching to extract fields. Quoted CSV values are stripped with `.replace(/^"|"$/g, "")` but complex quoted fields (commas inside quotes) are not handled.