# Regression Test Suite Design

**Date:** 2026-03-07
**Goal:** Protect existing API route behavior during code cleanup refactoring.

## Approach

- **Framework:** Jest + React Testing Library via `next/jest` transform
- **Mocking:** Mock everything — Firebase, EasyPost (global `fetch`), Stripe
- **Scope:** API routes only (highest risk during refactoring)

## File Structure

```
src/
  __tests__/
    api/
      upload.test.ts
      single-label.test.ts
      labels-merge.test.ts
      stripe-webhook.test.ts
    mocks/
      firestore.ts      # reusable getDoc return builders
      easypost.ts       # reusable fetch response builders
      stripe.ts         # mock constructEvent responses
```

## Commands

```bash
npm test                          # run all tests
npm test -- --watch               # watch mode
npm test -- upload                # single file
```

## Mocking Strategy

**Firebase:** Mock `@/firebase` module (exports fake `db`/`auth`), mock individual Firestore functions from `firebase/firestore` (`getDoc`, `setDoc`, `getDocs`, `doc`, `collection`, `query`, `where`, `serverTimestamp`). Each test controls `getDoc` return values to simulate user states.

**EasyPost:** Mock global `fetch` with `jest.fn()`. Tests provide mock implementations returning EasyPost-shaped responses (shipment with rates, bought shipment with label URL).

**Stripe:** Mock the `stripe` package so `webhooks.constructEvent` returns a fake event or throws for invalid signature tests.

## Test Cases

### `/api/upload` (~18 cases)

**Input validation**
- Returns 400 if orders array is empty
- Returns 400 if userId is missing
- Returns 400 if user has no easypostApiKey or fromAddress

**Free tier enforcement**
- Returns 403 with redirect URL if free user is at 10-label limit
- Allows request if free user is under limit
- Allows request if `isPro === true` regardless of usage count
- Allows request if `plan === "pro"` regardless of usage count

**Label generation logic**
- Selects Ground Advantage rate for high-value orders (`useEnvelope === false`)
- Falls back to cheapest rate when Ground Advantage is unavailable
- Uses `customAddress` when provided instead of order address fields
- Uses `selectedPackage` parcel dimensions when provided
- Skips an order silently if EasyPost returns no rates
- Skips an order silently if label purchase fails

**Firestore writes**
- Creates batch document when batchId is provided
- Saves order document with correct cost breakdown fields

**Post-processing**
- Updates usage count for free users after success
- Does NOT update usage count for Pro users
- Returns `groundAdvantage` and `envelopes` arrays separated correctly

### `/api/single-label` (~12 cases)

**Input validation**
- Returns 400 if userId is missing
- Returns 400 if customAddress is missing
- Returns 400 if user settings incomplete

**Free tier enforcement**
- Returns 403 if free user is at 10-label limit

**Rate selection**
- Filters to only USPS First or GroundAdvantage rates
- Returns 400 if no valid USPS rate available after filtering
- Selects cheapest valid rate

**Firestore writes**
- Creates/merges "single-labels" batch document
- Saves order document with correct fields

**Post-processing**
- Updates usage for free users
- Does NOT update usage for Pro users
- Returns `labelUrl` and `trackingCode`

### `/api/labels/merge` (4 cases)
- Fetches each URL and returns a merged PDF
- Skips a URL if its fetch response is not ok
- Returns correct `Content-Type: application/pdf` header
- Returns 500 on unexpected error

### `/api/stripe/webhook` (5 cases)
- Returns 400 if signature verification fails
- Returns 200 and does nothing for unhandled event types
- Sets `isPro: true` on user doc when `checkout.session.completed` fires
- Continues gracefully if session has no `customer_email`
- Continues gracefully if no Firestore user matches the email

**Total: ~39 test cases**
