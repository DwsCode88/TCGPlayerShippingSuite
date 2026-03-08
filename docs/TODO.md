# TCG Shipping Suite — TODO

## Security

- [ ] Add Firebase Admin SDK to API routes and verify ID tokens from `Authorization` header (currently trusts `userId` from request body — any caller can impersonate any user)
- [ ] Replace client SDK usage in API routes with Firebase Admin SDK
- [ ] Add Stripe webhook handler for `customer.subscription.deleted` to revoke Pro access on cancellation

## Duplicate / Dead Code

- [x] Delete `src/firebaseUtils.ts` (stale duplicate of `src/lib/userSettings.ts` with outdated type)
- [x] Delete or integrate `src/components/DashboardLayout.tsx` (unused — `SidebarLayout` is used everywhere)
- [x] Delete or integrate `src/components/RequireAuth.tsx` (exists but no page uses it)
- [x] Investigate and remove `src/components/UserHeader.tsx` if unused
- [x] Delete `src/app/api/labels/merge.ts` (leftover — `merge/route.ts` is the active file)
- [ ] Remove `papaparse` dependency or replace manual CSV parsing with it

## TypeScript Quality

- [x] Replace `useState<any[]>` for batches/orders in dashboard with proper typed interfaces
- [x] Type EasyPost API response shapes (rate objects, shipment objects) instead of `(r: any)`
- [ ] Add proper types to admin pages (`AdminStats.tsx`, `AdminUsers.tsx`)

## Code Duplication

- [x] Extract shared EasyPost auth + shipment creation logic from `/api/upload` and `/api/single-label` into `src/lib/easypost.ts`
- [x] Extract free-tier usage check + update logic into `src/lib/usageCheck.ts`

## Data Consistency

- [ ] Standardize `createdAt` across all Firestore writes (pick one: `serverTimestamp()`, `Date.now()`, or ISO string — and remove redundant `createdAtMillis`/`createdAtDisplay` fields)
- [x] Fix ZIP regex in `api/upload/route.ts` (double-escaped `\\D` vs correct `\D` in single-label route)

## Auth / Navigation

- [ ] Add `src/middleware.ts` to centralize auth guard instead of duplicating `useAuthState` + redirect in every page
- [x] Fix missing `router` in `useEffect` dependency array in `src/app/page.tsx`

## Minor Code Quality

- [ ] Replace hardcoded `"VaultTrove"` in `src/lib/generateOrderLabels.ts` with value from user settings
- [x] Replace `alert()` calls in batch page `downloadByType` with `toast` from `react-hot-toast`
- [ ] Consolidate dashboard's double Firestore batch fetch (all batches + recent batches) into one query
- [ ] Add request body schema validation (e.g., Zod) to all API routes
- [ ] Audit `src/lib/generateLabelWithLogo.ts` — remove if unused, document if used
- [ ] Fix CSV parsing to handle quoted fields containing commas (replace `line.split(",")` with PapaParse)

## Features — High Value

- [ ] Add confirmation dialog before generating labels (irreversible, costs money)
- [ ] Surface failed orders during batch processing — show which orders failed and allow retry
- [ ] Add void/refund label action in batch and order views (EasyPost supports label voiding)
- [ ] Add mobile navigation (sidebar is `hidden md:block` with no fallback)
- [ ] Add EasyPost address validation before purchasing labels

## Features — Medium Value

- [ ] Show rate preview per order before committing to "Generate Labels"
- [ ] Add archive/unarchive button in batch UI (`archived` field already exists in Firestore)
- [ ] Add pagination or infinite scroll to history and batch list views
- [ ] Add bulk package type assignment in upload preview table (e.g., "apply to all" or by filter)
- [ ] Track monthly label usage for Pro users and show breakdown on dashboard
- [ ] Add search/filter to batch order table (by name, order number, tracking code)
- [ ] Make per-order shipping option toggles (`usePennySleeve`, `useTopLoader`, `shippingShield`, `useEnvelope`) editable in upload preview table

## Features — Lower Priority

- [ ] Move Firebase config to `NEXT_PUBLIC_` environment variables (enables separate dev/prod projects)
- [ ] Clarify or remove `/demo` page
- [ ] Audit `/api/export-batches` — clarify purpose vs existing batch CSV download, remove if redundant
- [ ] Add rate limiting to API routes
- [ ] Fix `uploadDraft` localStorage key collision between browser tabs
- [ ] Validate generated tracking CSV against TCGplayer's exact expected format
- [ ] Explore multi-carrier support (UPS/FedEx via EasyPost)
