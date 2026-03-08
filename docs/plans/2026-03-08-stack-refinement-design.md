# Stack Refinement Design

**Date:** 2026-03-08
**Goal:** Improve developer experience and UI quality while keeping the same product, Firebase backend, and Vercel deployment.

## Approach

Incremental refinement of the existing Next.js stack. No framework change, no data migration, no new features. Three self-contained phases that each ship independently.

## Stack Changes

| Layer | Current | After |
|---|---|---|
| API routing | Raw Next.js route handlers | Hono (catch-all route) |
| API auth | Trust `userId` from request body | Firebase Admin SDK token verification |
| Request validation | None | Zod schemas on every route |
| UI components | Hand-rolled Tailwind | shadcn/ui + Radix UI primitives |
| Forms | Uncontrolled HTML | react-hook-form + Zod |
| Auth middleware | Per-page `useAuthState` + redirect | `src/middleware.ts` (once) |

**Unchanged:** Firebase Auth, Firestore, Storage, EasyPost calls, Stripe webhook, pdf-lib, Next.js App Router, Vercel deployment, Tailwind CSS.

## Architecture

```
Browser
  └── Next.js 15 App Router
        ├── src/middleware.ts          Firebase token check for /dashboard/*
        ├── /app/(dashboard)/...       All dashboard pages (shadcn/ui components)
        └── /app/api/[[...route]]/     Hono router
              ├── middleware: verifyFirebaseToken → c.set('uid')
              ├── POST /api/labels/batch    (was /api/upload)
              ├── POST /api/labels/single   (was /api/single-label)
              ├── POST /api/labels/merge    (unchanged)
              └── POST /api/stripe/webhook  (skips auth middleware)

Firebase Admin SDK (server-only)
  ├── adminAuth.verifyIdToken(token) → uid
  └── adminDb (Firestore, same collections)

Firebase Client SDK (browser-only, unchanged)
  ├── src/firebase.ts
  └── react-firebase-hooks
```

## Phase Plan

### Phase 1: Backend Foundation
- Install `firebase-admin`, initialize with service account env var
- Create `src/lib/admin.ts` exporting `adminAuth` and `adminDb`
- Mount Hono in `/app/api/[[...route]]/route.ts`
- Add auth middleware: verify `Authorization: Bearer <idToken>` header, set `uid` on context
- Migrate all four routes to Hono with Zod request validation
- Remove client SDK (`@/firebase`) from all API routes
- Add `src/middleware.ts` using `next/server` to check Firebase session cookie or forward to login

**Result:** API routes are secure. No user-visible changes.

### Phase 2: UI Component Swap
- `npx shadcn@latest init`
- Install: `button`, `input`, `dialog`, `table`, `select`, `form`, `card`, `badge`, `separator`
- Replace components page by page: settings → upload preview → batch detail → dashboard → history
- Settings form: migrate to react-hook-form + Zod (adds real client-side validation)

**Result:** Consistent, accessible UI. Significant visual improvement.

### Phase 3: Polish
- Fix remaining TODO.md items: admin page types, CSV parsing (PapaParse), `createdAt` standardization
- Add Stripe `customer.subscription.deleted` webhook handler
- Consolidate dashboard's double Firestore batch fetch

## Key Decisions

**Why Hono instead of individual route files?**
Shared auth middleware eliminates ~30 lines of duplicated token-check boilerplate. Zod validators make request shape explicit. Routes become focused on business logic only.

**Why shadcn/ui instead of a component library?**
You own the source — no version lock-in, full customization. Built on Radix UI so accessibility is handled. CSS variable theming makes visual differentiation easy.

**Why keep Firebase?**
Migration cost outweighs benefit at current scale. The real Firebase pain (client SDK in API routes) is fixed by the Admin SDK switch in Phase 1, without touching the data model.

## Environment Variables Added

```
FIREBASE_SERVICE_ACCOUNT_JSON   # base64-encoded service account for Admin SDK
```

Existing vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) unchanged.
