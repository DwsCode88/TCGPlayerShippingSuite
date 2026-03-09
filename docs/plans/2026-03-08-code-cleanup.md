# Code Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead code, fix minor bugs, improve TypeScript types, and deduplicate the EasyPost/usage logic shared between the two label-generation API routes.

**Architecture:** All changes are protected by the 38-test regression suite. Run `npm test --no-coverage` after every task to confirm nothing broke. Tasks are ordered from safest (pure deletion) to most impactful (refactoring). The test suite covers all API route behavior so the deduplication tasks in Tasks 7–8 are safe to execute.

**Tech Stack:** Next.js 15 App Router, TypeScript, Firebase Firestore (client SDK), EasyPost REST API, react-hot-toast

---

## Task 1: Delete dead files

Five files exist that are never imported anywhere in the codebase.

**Files to delete:**
- `src/firebaseUtils.ts` — stale duplicate of `src/lib/userSettings.ts`
- `src/components/DashboardLayout.tsx` — superseded by `SidebarLayout.tsx`, zero imports
- `src/components/RequireAuth.tsx` — auth guard HOC, zero imports (pages do their own guard)
- `src/components/UserHeader.tsx` — zero imports
- `src/app/api/labels/merge.ts` — leftover file; the real route handler is at `src/app/api/labels/merge/route.ts`

**Step 1: Confirm each file has zero imports**

```bash
grep -r "firebaseUtils\|DashboardLayout\|RequireAuth\|UserHeader" C:/Users/RC/github/TCGPlayerShippingSuite/src --include="*.ts" --include="*.tsx" -l
```

Expected: no output (or only the files themselves, which is fine).

```bash
grep -r "from.*labels/merge'" C:/Users/RC/github/TCGPlayerShippingSuite/src --include="*.ts" --include="*.tsx"
```

Expected: no output.

**Step 2: Delete the files**

```bash
rm C:/Users/RC/github/TCGPlayerShippingSuite/src/firebaseUtils.ts
rm C:/Users/RC/github/TCGPlayerShippingSuite/src/components/DashboardLayout.tsx
rm C:/Users/RC/github/TCGPlayerShippingSuite/src/components/RequireAuth.tsx
rm C:/Users/RC/github/TCGPlayerShippingSuite/src/components/UserHeader.tsx
rm C:/Users/RC/github/TCGPlayerShippingSuite/src/app/api/labels/merge.ts
```

**Step 3: Run tests to confirm nothing broke**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 4: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add -A && git commit -m "chore: delete 5 dead files (DashboardLayout, RequireAuth, UserHeader, firebaseUtils, labels/merge.ts stub)"
```

---

## Task 2: Fix ZIP regex bug in upload route

**File:** `src/app/api/upload/route.ts` line ~100

**The bug:** The upload route has `/\\D/g` (a regex that matches a literal backslash followed by "D") instead of `/\D/g` (a regex that strips non-digit characters). The single-label route has the correct `/\D/g`. This means zip codes like `"62701-1234"` are NOT stripped to `"627011234"` in batch uploads.

**Step 1: Confirm the bug exists**

```bash
grep -n "\\\\D" C:/Users/RC/github/TCGPlayerShippingSuite/src/app/api/upload/route.ts
```

Expected: shows a line with `\\D` in a regex.

**Step 2: Fix the regex**

In `src/app/api/upload/route.ts`, find this line (around line 100):
```ts
zip: order.zip?.replace(/\\D/g, ""),
```

Change it to:
```ts
zip: order.zip?.replace(/\D/g, ""),
```

**Step 3: Run tests**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 4: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add src/app/api/upload/route.ts && git commit -m "fix: correct ZIP code regex in upload route (\\D → \\D non-digit strip)"
```

---

## Task 3: Replace alert() with toast in batch page

**File:** `src/app/dashboard/batch/[batchId]/page.tsx`

The `downloadByType` function uses `alert()` for error messages. The app already imports `react-hot-toast` in the layout. The batch page needs to import toast and use it instead.

**Step 1: Read the current file to find alert() calls**

Read `src/app/dashboard/batch/[batchId]/page.tsx` and find the `downloadByType` function. It has two `alert()` calls:
- `alert("No labels found for this type.")`
- `alert("Failed to generate PDF")`

**Step 2: Add toast import at the top of the file**

After the existing imports, add:
```ts
import { toast } from "react-hot-toast";
```

**Step 3: Replace both alert() calls**

Replace:
```ts
alert("No labels found for this type.");
```
With:
```ts
toast.error("No labels found for this type.");
return;
```
(Keep the `return` that follows.)

Replace:
```ts
alert("Failed to generate PDF");
```
With:
```ts
toast.error("Failed to generate PDF");
```

**Step 4: Run tests**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 5: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add src/app/dashboard/batch/[batchId]/page.tsx && git commit -m "fix: replace alert() with toast in batch page download errors"
```

---

## Task 4: Fix useEffect dependency array in home page

**File:** `src/app/page.tsx`

The `useEffect` that redirects authenticated users is missing `router` in its dependency array, causing an ESLint warning and potential stale closure bug.

**Step 1: Read the file**

Read `src/app/page.tsx`. Find:
```ts
useEffect(() => {
  if (user) router.push("/dashboard");
}, [user]);
```

**Step 2: Add router to the dependency array**

Change to:
```ts
useEffect(() => {
  if (user) router.push("/dashboard");
}, [user, router]);
```

**Step 3: Run tests**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 4: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add src/app/page.tsx && git commit -m "fix: add router to useEffect dependency array in home page"
```

---

## Task 5: Add TypeScript types to dashboard page

**File:** `src/app/dashboard/page.tsx`

The dashboard uses `useState<any[]>` for `batches` and `recentBatches`. Define a `Batch` type and use it.

**Step 1: Read the current file**

Read `src/app/dashboard/page.tsx` to understand current state shape.

**Step 2: Add a Batch type and replace any[]**

At the top of the file, after the imports, add:
```ts
type Batch = {
  id: string;
  batchName?: string;
  createdAt?: number;
  createdAtMillis?: number;
  archived?: boolean;
  userId: string;
};
```

Then change:
```ts
const [batches, setBatches] = useState<any[]>([]);
const [recentBatches, setRecentBatches] = useState<any[]>([]);
```
To:
```ts
const [batches, setBatches] = useState<Batch[]>([]);
const [recentBatches, setRecentBatches] = useState<Batch[]>([]);
```

And update the Firestore fetch map calls to include the `id` field (they already spread `doc.data()`, just ensure the type cast is correct):
```ts
const allBatchData = allBatchSnap.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),
})) as Batch[];

const recentBatchData = recentBatchSnap.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),
})) as Batch[];
```

**Step 3: Run tests**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 4: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add src/app/dashboard/page.tsx && git commit -m "refactor: replace useState<any[]> with typed Batch interface in dashboard"
```

---

## Task 6: Add EasyPost type definitions

**Files:**
- Create: `src/lib/easypost-types.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/single-label/route.ts`

Both API routes use `(r: any)` for EasyPost rate and shipment objects. Define the minimal types needed.

**Step 1: Create `src/lib/easypost-types.ts`**

```ts
export type EasyPostRate = {
  id: string;
  carrier: string;
  service: string;
  rate: string;
};

export type EasyPostPostageLabel = {
  label_url: string;
};

export type EasyPostTracker = {
  public_url: string;
};

export type EasyPostShipment = {
  id: string;
  rates: EasyPostRate[];
  error?: string;
};

export type EasyPostBoughtShipment = {
  tracking_code: string;
  postage_label?: EasyPostPostageLabel;
  tracker?: EasyPostTracker;
  error?: string;
};
```

**Step 2: Update `src/app/api/upload/route.ts`**

Add import at top:
```ts
import type { EasyPostRate, EasyPostShipment, EasyPostBoughtShipment } from "@/lib/easypost-types";
```

Replace the rate reduce callbacks that use `(r: any)`:
```ts
// Change:
rate = shipment.rates.find(
  (r: any) => r.carrier === "USPS" && r.service === "GroundAdvantage"
);
// To:
rate = (shipment as EasyPostShipment).rates.find(
  (r) => r.carrier === "USPS" && r.service === "GroundAdvantage"
);
```

```ts
// Change:
rate = shipment.rates.reduce(
  (lowest: any, current: any) =>
    parseFloat(current.rate) < parseFloat(lowest?.rate || "Infinity")
      ? current
      : lowest,
  null
);
// To:
rate = (shipment as EasyPostShipment).rates.reduce(
  (lowest: EasyPostRate | null, current: EasyPostRate) =>
    parseFloat(current.rate) < parseFloat(lowest?.rate || "Infinity")
      ? current
      : lowest,
  null
);
```

Add type annotation to `shipment` and `bought`:
```ts
const shipment = await createRes.json() as EasyPostShipment;
// ...
const bought = await buyRes.json() as EasyPostBoughtShipment;
```

**Step 3: Update `src/app/api/single-label/route.ts`**

Add import:
```ts
import type { EasyPostRate, EasyPostShipment, EasyPostBoughtShipment } from "@/lib/easypost-types";
```

Apply the same type casts to `shipment` and `bought`, and replace `(r: any)` in the filter/reduce:
```ts
const shipment = await createRes.json() as EasyPostShipment;
// ...
const filteredRates = shipment.rates.filter(
  (r: EasyPostRate) => r.carrier === "USPS" && validServices.includes(r.service)
);
const rate = filteredRates.reduce(
  (lowest: EasyPostRate | null, current: EasyPostRate) =>
    parseFloat(current.rate) < parseFloat(lowest?.rate || "Infinity")
      ? current
      : lowest,
  null
);
// ...
const bought = await buyRes.json() as EasyPostBoughtShipment;
```

**Step 4: Run tests**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 5: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add src/lib/easypost-types.ts src/app/api/upload/route.ts src/app/api/single-label/route.ts && git commit -m "refactor: add EasyPost type definitions, replace (r: any) in API routes"
```

---

## Task 7: Extract shared EasyPost auth helper

**Files:**
- Create: `src/lib/easypost.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/single-label/route.ts`

Both routes build the same EasyPost Basic auth header: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`. Extract to a shared function.

**Step 1: Create `src/lib/easypost.ts`**

```ts
import type { EasyPostRate, EasyPostShipment, EasyPostBoughtShipment } from "./easypost-types";

export function getEasypostAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(apiKey + ":").toString("base64")}`;
}

export type { EasyPostRate, EasyPostShipment, EasyPostBoughtShipment };
```

**Step 2: Update `src/app/api/upload/route.ts`**

Add import:
```ts
import { getEasypostAuthHeader } from "@/lib/easypost";
```

Remove the inline auth header construction:
```ts
// DELETE this line:
const authHeader = `Basic ${Buffer.from(userApiKey + ":").toString("base64")}`;
```

Replace with:
```ts
const authHeader = getEasypostAuthHeader(userApiKey);
```

**Step 3: Update `src/app/api/single-label/route.ts`**

Same change: import `getEasypostAuthHeader`, remove inline construction, use the helper.

**Step 4: Run tests**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 5: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add src/lib/easypost.ts src/app/api/upload/route.ts src/app/api/single-label/route.ts && git commit -m "refactor: extract getEasypostAuthHeader helper, remove duplicated Basic auth construction"
```

---

## Task 8: Extract shared usage check/update logic

**Files:**
- Create: `src/lib/usageCheck.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/single-label/route.ts`

Both routes duplicate the free-tier limit check and the post-success usage count update. Extract to shared functions.

**Step 1: Read both route files carefully** to understand the exact shape of the usage check and update logic before extracting.

**Step 2: Create `src/lib/usageCheck.ts`**

```ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

export type UsageCheckResult = {
  isPro: boolean;
  usageCount: number;
  usageRef: ReturnType<typeof doc>;
  currentMonth: string;
};

export async function getUserUsage(userId: string, userSettings: Record<string, unknown>): Promise<UsageCheckResult> {
  const usageRef = doc(db, "usage", userId);
  const usageSnap = await getDoc(usageRef);
  const usage = usageSnap.exists() ? usageSnap.data() : { count: 0, month: "" };
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageCount = usage?.month === currentMonth ? usage.count : 0;
  const isPro = userSettings?.isPro === true || userSettings?.plan === "pro";
  return { isPro, usageCount, usageRef, currentMonth };
}

export async function incrementUsage(
  usageRef: ReturnType<typeof doc>,
  currentMonth: string,
  previousCount: number,
  addedCount: number
): Promise<void> {
  await setDoc(
    usageRef,
    {
      month: currentMonth,
      count: previousCount + addedCount,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}
```

**Step 3: Update `src/app/api/upload/route.ts`**

Add import:
```ts
import { getUserUsage, incrementUsage } from "@/lib/usageCheck";
```

Replace the inline usage check block (the `getDoc(usageRef)` call and surrounding logic) with:
```ts
const { isPro, usageCount, usageRef, currentMonth } = await getUserUsage(userId, userSettings);
```

Replace the post-success usage update block with:
```ts
if (!isPro) {
  await incrementUsage(usageRef, currentMonth, usageCount, orders.length);
}
```

Remove the now-unused inline `usageRef`, `usageSnap`, `usage`, `currentMonth`, `usageCount`, `isPro` variable declarations.

**Step 4: Update `src/app/api/single-label/route.ts`**

Same pattern: import and use `getUserUsage` and `incrementUsage`, remove inline duplicates.

**Step 5: Run tests**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && npm test --no-coverage 2>&1 | tail -5
```

Expected: `38 passed, 38 total`

**Step 6: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add src/lib/usageCheck.ts src/app/api/upload/route.ts src/app/api/single-label/route.ts && git commit -m "refactor: extract getUserUsage and incrementUsage helpers, remove duplicated free-tier logic"
```

---

## Task 9: Update TODO.md to mark completed items

**File:** `docs/TODO.md`

Check off every item addressed in Tasks 1–8.

**Step 1: Mark completed items**

Mark the following as done (change `- [ ]` to `- [x]`):
- `Delete src/firebaseUtils.ts`
- `Delete or integrate src/components/DashboardLayout.tsx`
- `Delete or integrate src/components/RequireAuth.tsx`
- `Investigate and remove src/components/UserHeader.tsx if unused`
- `Delete src/app/api/labels/merge.ts`
- `Replace useState<any[]> for batches/orders in dashboard with proper typed interfaces`
- `Type EasyPost API response shapes`
- `Extract shared EasyPost auth + shipment creation logic`
- `Extract free-tier usage check + update logic`
- `Replace alert() calls in batch page`
- `Fix missing router in useEffect dependency array in src/app/page.tsx`
- `Fix ZIP regex in api/upload/route.ts`

**Step 2: Commit**

```bash
cd C:/Users/RC/github/TCGPlayerShippingSuite && git add docs/TODO.md && git commit -m "chore: mark completed cleanup items in TODO.md"
```
