# Stack Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace raw Next.js API routes with Hono + Firebase Admin SDK + Zod validation, then upgrade the UI with shadcn/ui, keeping the app shippable after every task.

**Architecture:** Hono mounts in a single Next.js catch-all route (`/app/api/[[...route]]/route.ts`). All API routes verify Firebase ID tokens via Admin SDK instead of trusting `userId` from the request body. Frontend pages call `user.getIdToken()` and send `Authorization: Bearer <token>` headers.

**Tech Stack:** Hono, firebase-admin, zod, @hono/zod-validator, shadcn/ui, react-hook-form, @hookform/resolvers

---

## Phase 1: Backend Foundation

### Task 1: Install dependencies and create Firebase Admin helper

**Files:**
- Create: `src/lib/admin.ts`

**Step 1: Install packages**

```bash
npm install hono firebase-admin @hono/zod-validator zod
```

Expected: packages added to `node_modules`, no errors.

**Step 2: Add env var to `.env.local`**

Get a Firebase service account key from Firebase Console → Project Settings → Service Accounts → Generate new private key. Download the JSON file, then base64-encode it:

```bash
# On Mac/Linux:
base64 -i serviceAccount.json | tr -d '\n'
# On Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))
```

Add to `.env.local`:
```
FIREBASE_SERVICE_ACCOUNT_JSON=<paste base64 string here>
```

**Step 3: Create `src/lib/admin.ts`**

```ts
import * as admin from "firebase-admin";

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");

  const serviceAccount = JSON.parse(
    Buffer.from(raw, "base64").toString("utf-8")
  );

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = getApp();

export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);
```

**Step 4: Verify it loads without error**

```bash
node -e "require('./src/lib/admin.ts')" 2>&1
```

Actually use TypeScript check instead:
```bash
npx tsc --noEmit
```
Expected: no errors related to admin.ts (there may be pre-existing errors elsewhere).

**Step 5: Commit**

```bash
git add src/lib/admin.ts .env.local
git commit -m "feat: add Firebase Admin SDK helper"
```

Note: `.env.local` should already be in `.gitignore` — verify before committing.

---

### Task 2: Mount Hono with auth middleware

**Files:**
- Create: `src/app/api/[[...route]]/route.ts`

**Step 1: Create the Hono app with auth middleware**

Create `src/app/api/[[...route]]/route.ts`:

```ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { adminAuth } from "@/lib/admin";

type Variables = {
  uid: string;
};

const app = new Hono<{ Variables: Variables }>().basePath("/api");

// Auth middleware — skip for Stripe webhook
app.use("*", async (c, next) => {
  if (c.req.path === "/api/stripe/webhook") {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    c.set("uid", decoded.uid);
    return next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Health check — useful for verifying the router mounts correctly
app.get("/health", (c) => c.json({ ok: true }));

export const GET = handle(app);
export const POST = handle(app);
```

**Step 2: Start dev server and test health endpoint**

```bash
npm run dev
```

In another terminal:
```bash
curl http://localhost:3000/api/health
```
Expected: `{"ok":true}`

```bash
curl -X POST http://localhost:3000/api/health
```
Expected: `{"ok":true}` (GET handler responds to POST on health check — that's fine, it means Hono is mounted)

**Step 3: Commit**

```bash
git add src/app/api/[[...route]]/route.ts
git commit -m "feat: mount Hono router with Firebase Admin auth middleware"
```

---

### Task 3: Migrate /api/upload → Hono

**Files:**
- Modify: `src/app/api/[[...route]]/route.ts`
- Delete: `src/app/api/upload/route.ts`

**Step 1: Add Zod schema and batch labels route to the Hono app**

Add to `src/app/api/[[...route]]/route.ts` (before the `export` lines):

```ts
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { adminDb } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

const addressSchema = z.object({
  name: z.string(),
  street1: z.string(),
  street2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string().optional(),
});

const packageSchema = z.object({
  name: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  predefined_package: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
});

const orderSchema = z.object({
  batchId: z.string().optional(),
  batchName: z.string().optional(),
  orderNumber: z.string().optional(),
  name: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  customAddress: addressSchema.optional(),
  useEnvelope: z.boolean().optional(),
  usePennySleeve: z.boolean().optional(),
  useTopLoader: z.boolean().optional(),
  shippingShield: z.boolean().optional(),
  nonMachinable: z.boolean().optional(),
  weight: z.number().optional(),
  selectedPackage: packageSchema.optional(),
  notes: z.string().optional(),
});

const batchLabelsSchema = z.array(orderSchema).min(1);

app.post("/labels/batch", zValidator("json", batchLabelsSchema), async (c) => {
  const uid = c.get("uid");
  const orders = c.req.valid("json");

  // Load user settings
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const userSettings = userSnap.exists ? userSnap.data()! : {};
  const userApiKey = userSettings.easypostApiKey as string | undefined;
  const fromAddress = userSettings.fromAddress as Record<string, string> | undefined;

  if (!userApiKey || !fromAddress) {
    return c.json({ error: "User settings incomplete" }, 400);
  }

  const authHeader = `Basic ${Buffer.from(userApiKey + ":").toString("base64")}`;

  // Free tier check
  const usageSnap = await adminDb.collection("usage").doc(uid).get();
  const usage = usageSnap.exists ? usageSnap.data()! : { count: 0, month: "" };
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageCount = usage.month === currentMonth ? (usage.count as number) : 0;
  const isPro = userSettings.isPro === true || userSettings.plan === "pro";

  if (!isPro && usageCount + orders.length > 10) {
    return c.json(
      {
        error: "🚫 You've hit your 10-label Free plan limit. Upgrade to Pro for unlimited labels.",
        redirect: "/dashboard/billing",
      },
      403
    );
  }

  const first = orders[0];
  const groundAdvantage: { url: string; tracking: string }[] = [];
  const envelopes: { url: string; tracking: string }[] = [];
  const now = new Date();

  if (first.batchId) {
    await adminDb.collection("batches").doc(first.batchId).set(
      {
        batchName: first.batchName || "Unnamed Batch",
        createdAt: FieldValue.serverTimestamp(),
        createdAtMillis: now.getTime(),
        createdAtDisplay: now.toLocaleString(),
        archived: false,
        notes: "",
        userId: uid,
      },
      { merge: true }
    );
  }

  for (const order of orders) {
    try {
      const isHighValue = order.useEnvelope === false;
      const customPackage = order.selectedPackage || {};
      const parcel = customPackage.name
        ? {
            predefined_package: customPackage.predefined_package || undefined,
            weight: parseFloat(String(customPackage.weight)) || 1,
            length: customPackage.length || undefined,
            width: customPackage.width || undefined,
            height: customPackage.height || undefined,
          }
        : {
            predefined_package: isHighValue ? "Parcel" : "Letter",
            weight: isHighValue ? 3 : Math.max(1, order.weight || 1),
          };

      const to_address = order.customAddress
        ? {
            name: order.customAddress.name,
            street1: order.customAddress.street1,
            city: order.customAddress.city,
            state: order.customAddress.state,
            zip: order.customAddress.zip?.replace(/\D/g, ""),
            country: order.customAddress.country || "US",
          }
        : {
            name: order.name,
            street1: order.address1,
            street2: order.address2,
            city: order.city,
            state: order.state,
            zip: order.zip?.replace(/\D/g, ""),
            country: "US",
          };

      const createRes = await fetch("https://api.easypost.com/v2/shipments", {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment: {
            to_address,
            from_address: {
              name: fromAddress.name,
              street1: fromAddress.street1,
              city: fromAddress.city,
              state: fromAddress.state,
              zip: fromAddress.zip,
              country: "US",
            },
            parcel,
            options: {
              label_format: "PDF",
              label_size: "4x6",
              machinable: !order.nonMachinable,
              print_custom_1: order.orderNumber || "",
            },
          },
        }),
      });

      const shipment = await createRes.json();
      if (shipment.error || !shipment.rates?.length) continue;

      let rate: { id: string; carrier: string; service: string; rate: string } | undefined;
      if (isHighValue) {
        rate = shipment.rates.find(
          (r: { carrier: string; service: string }) =>
            r.carrier === "USPS" && r.service === "GroundAdvantage"
        );
      }
      if (!rate) {
        rate = shipment.rates.reduce(
          (
            lowest: { rate: string } | undefined,
            current: { rate: string }
          ) =>
            parseFloat(current.rate) < parseFloat(lowest?.rate ?? "Infinity")
              ? current
              : lowest,
          undefined
        );
      }
      if (!rate) continue;

      const buyRes = await fetch(
        `https://api.easypost.com/v2/shipments/${shipment.id}/buy`,
        {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ rate }),
        }
      );

      const bought = await buyRes.json();
      if (!bought?.postage_label?.label_url) continue;

      const orderId = uuidv4();
      const envelopeCost = order.useEnvelope ? (userSettings.envelopeCost as number) || 0.1 : 0;
      const shieldCost = order.shippingShield ? (userSettings.shieldCost as number) || 0.1 : 0;
      const pennyCost = order.usePennySleeve ? (userSettings.pennySleeveCost as number) || 0.02 : 0;
      const loaderCost = order.useTopLoader ? (userSettings.topLoaderCost as number) || 0.12 : 0;
      const labelCost = parseFloat(rate.rate || "0.63");
      const totalCost = parseFloat((labelCost + envelopeCost + shieldCost + pennyCost + loaderCost).toFixed(2));
      const labelType = rate.service === "GroundAdvantage" ? "ground" : "envelope";

      await adminDb.collection("orders").doc(orderId).set({
        userId: uid,
        batchId: order.batchId,
        batchName: order.batchName,
        orderNumber: order.orderNumber,
        trackingCode: bought.tracking_code,
        trackingUrl: bought.tracker?.public_url || "",
        labelUrl: bought.postage_label.label_url,
        toName: to_address.name,
        labelCost,
        envelopeCost,
        shieldCost,
        pennyCost,
        loaderCost,
        usePennySleeve: !!order.usePennySleeve,
        useTopLoader: !!order.useTopLoader,
        useEnvelope: !!order.useEnvelope,
        shippingShield: !!order.shippingShield,
        totalCost,
        createdAt: Date.now(),
        dashboardTimestamp: new Date().toISOString(),
        labelType,
        notes: order.notes || "",
      });

      const labelData = { url: bought.postage_label.label_url, tracking: bought.tracking_code };
      if (labelType === "ground") {
        groundAdvantage.push(labelData);
      } else {
        envelopes.push(labelData);
      }
    } catch (err) {
      console.error(`🔥 Error processing order:`, err);
    }
  }

  if (!isPro) {
    await adminDb
      .collection("usage")
      .doc(uid)
      .set(
        { month: currentMonth, count: usageCount + orders.length, updatedAt: Date.now() },
        { merge: true }
      );
  }

  return c.json({ groundAdvantage, envelopes });
});
```

**Step 2: Delete the old route file**

```bash
rm src/app/api/upload/route.ts
```

(Also delete the now-empty `src/app/api/upload/` directory if empty.)

**Step 3: Update the frontend call site**

Find where `/api/upload` is called:
```bash
grep -r "api/upload" src/ --include="*.ts" --include="*.tsx"
```

In the file that calls `/api/upload`, get an ID token before the fetch and add the Authorization header. Example pattern to apply wherever the call exists:

```ts
// Before: fetch('/api/upload', { method: 'POST', body: ... })
// After:
const token = await user.getIdToken();
const res = await fetch('/api/labels/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(orders),
});
```

Note: `user` here is the Firebase Auth user object from `useAuthState`. The call site already has access to it.

**Step 4: Test manually**

```bash
npm run dev
```

Go to the upload page, generate labels. Verify labels are created and stored in Firestore.

**Step 5: Commit**

```bash
git add src/app/api/[[...route]]/route.ts
git commit -m "feat: migrate /api/upload to Hono /api/labels/batch with Admin SDK"
```

---

### Task 4: Migrate /api/single-label → Hono

**Files:**
- Modify: `src/app/api/[[...route]]/route.ts`
- Delete: `src/app/api/single-label/route.ts`

**Step 1: Add the single label route**

Add to `src/app/api/[[...route]]/route.ts` (before exports):

```ts
const singleLabelSchema = z.object({
  customAddress: addressSchema,
  orderNumber: z.string().optional(),
  nonMachinable: z.boolean().optional(),
  selectedPackage: packageSchema.optional(),
});

app.post("/labels/single", zValidator("json", singleLabelSchema), async (c) => {
  const uid = c.get("uid");
  const order = c.req.valid("json");

  const userSnap = await adminDb.collection("users").doc(uid).get();
  const userSettings = userSnap.exists ? userSnap.data()! : {};
  const userApiKey = userSettings.easypostApiKey as string | undefined;
  const fromAddress = userSettings.fromAddress as Record<string, string> | undefined;

  if (!userApiKey || !fromAddress) {
    return c.json({ error: "User settings incomplete" }, 400);
  }

  const usageSnap = await adminDb.collection("usage").doc(uid).get();
  const usage = usageSnap.exists ? usageSnap.data()! : { count: 0, month: "" };
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageCount = usage.month === currentMonth ? (usage.count as number) : 0;
  const isPro = userSettings.isPro === true || userSettings.plan === "pro";

  if (!isPro && usageCount + 1 > 10) {
    return c.json(
      {
        error: "🚫 You've hit your 10-label Free plan limit. Upgrade to Pro for unlimited labels.",
        redirect: "/dashboard/billing",
      },
      403
    );
  }

  const authHeader = `Basic ${Buffer.from(userApiKey + ":").toString("base64")}`;

  const to_address = {
    name: order.customAddress.name,
    street1: order.customAddress.street1,
    city: order.customAddress.city,
    state: order.customAddress.state,
    zip: order.customAddress.zip?.replace(/\D/g, ""),
    country: order.customAddress.country || "US",
  };

  const customPackage = order.selectedPackage || {};
  const parcel = customPackage.name
    ? {
        predefined_package: customPackage.predefined_package || undefined,
        weight: parseFloat(String(customPackage.weight)) || 1,
        length: customPackage.length || undefined,
        width: customPackage.width || undefined,
        height: customPackage.height || undefined,
      }
    : { predefined_package: "Letter", weight: 1 };

  try {
    const createRes = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        shipment: {
          to_address,
          from_address: {
            name: fromAddress.name,
            street1: fromAddress.street1,
            city: fromAddress.city,
            state: fromAddress.state,
            zip: fromAddress.zip,
            country: "US",
          },
          parcel,
          options: {
            label_format: "PDF",
            label_size: "4x6",
            machinable: !order.nonMachinable,
          },
        },
      }),
    });

    const shipment = await createRes.json();

    if (shipment.error || !shipment.rates?.length) {
      return c.json({ error: "Shipment creation failed" }, 400);
    }

    const validServices = ["First", "GroundAdvantage"];
    const filteredRates = shipment.rates.filter(
      (r: { carrier: string; service: string }) =>
        r.carrier === "USPS" && validServices.includes(r.service)
    );

    const rate = filteredRates.reduce(
      (lowest: { rate: string } | undefined, current: { rate: string }) =>
        parseFloat(current.rate) < parseFloat(lowest?.rate ?? "Infinity") ? current : lowest,
      undefined
    );

    if (!rate) {
      return c.json({ error: "No USPS First-Class or Ground Advantage rate available" }, 400);
    }

    const buyRes = await fetch(
      `https://api.easypost.com/v2/shipments/${shipment.id}/buy`,
      {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ rate }),
      }
    );

    const bought = await buyRes.json();
    if (!bought?.postage_label?.label_url) {
      return c.json({ error: "Label purchase failed" }, 400);
    }

    const orderId = uuidv4();
    const batchId = "single-labels";

    await adminDb.collection("batches").doc(batchId).set(
      {
        batchName: "Single Labels",
        userId: uid,
        createdAt: FieldValue.serverTimestamp(),
        archived: false,
        notes: "Auto-generated for single-labels",
      },
      { merge: true }
    );

    await adminDb.collection("orders").doc(orderId).set({
      userId: uid,
      batchId,
      batchName: "Single Labels",
      orderNumber: order.orderNumber || "",
      trackingCode: bought.tracking_code,
      trackingUrl: bought.tracker?.public_url || "",
      labelUrl: bought.postage_label.label_url,
      toName: to_address.name,
      labelCost: parseFloat(rate.rate || "0.63"),
      totalCost: parseFloat(rate.rate || "0.63"),
      useEnvelope: true,
      createdAt: Date.now(),
      dashboardTimestamp: new Date().toISOString(),
      labelType: rate.service === "GroundAdvantage" ? "ground" : "envelope",
      notes: "",
    });

    if (!isPro) {
      await adminDb
        .collection("usage")
        .doc(uid)
        .set(
          { month: currentMonth, count: usageCount + 1, updatedAt: Date.now() },
          { merge: true }
        );
    }

    return c.json({
      labelUrl: bought.postage_label.label_url,
      trackingCode: bought.tracking_code,
    });
  } catch (err) {
    console.error("🔥 Error creating label:", err);
    return c.json({ error: "Unexpected error" }, 500);
  }
});
```

**Step 2: Delete the old route file**

```bash
rm src/app/api/single-label/route.ts
```

**Step 3: Update the frontend call site**

Find where `/api/single-label` is called:
```bash
grep -r "api/single-label" src/ --include="*.ts" --include="*.tsx"
```

Apply the same token pattern as Task 3. Change the URL to `/api/labels/single` and the body from `[order]` (array) to `order` (single object — the new schema takes a single object, not an array):

```ts
const token = await user.getIdToken();
const res = await fetch('/api/labels/single', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(order), // single object, not array
});
```

**Step 4: Test manually** — use the single-label page to generate a label.

**Step 5: Commit**

```bash
git add src/app/api/[[...route]]/route.ts
git commit -m "feat: migrate /api/single-label to Hono /api/labels/single with Admin SDK"
```

---

### Task 5: Migrate /api/labels/merge and /api/stripe/webhook to Hono

**Files:**
- Modify: `src/app/api/[[...route]]/route.ts`
- Delete: `src/app/api/labels/merge/route.ts`
- Delete: `src/app/api/stripe/webhook/route.ts`

**Step 1: Add merge route**

Add to `src/app/api/[[...route]]/route.ts`:

```ts
import { PDFDocument } from "pdf-lib";

app.post("/labels/merge", async (c) => {
  try {
    const urls: string[] = await c.req.json();
    const mergedPdf = await PDFDocument.create();

    for (const url of urls) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      const singlePdf = await PDFDocument.load(bytes);
      const pages = await mergedPdf.copyPages(singlePdf, singlePdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const finalBytes = await mergedPdf.save();

    return new Response(Buffer.from(finalBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="labels.pdf"',
      },
    });
  } catch (err) {
    console.error("❌ Error merging PDFs:", err);
    return c.json({ error: "Failed to merge PDFs" }, 500);
  }
});
```

**Step 2: Add Stripe webhook route**

```ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16" as any,
});

app.post("/stripe/webhook", async (c) => {
  const sig = c.req.header("stripe-signature")!;
  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_email;

    if (!email) {
      console.warn("⚠️ No email found in checkout.session.completed");
      return c.json({ received: true });
    }

    try {
      const snapshot = await adminDb
        .collection("users")
        .where("email", "==", email)
        .get();
      const docRef = snapshot.docs[0]?.ref;

      if (docRef) {
        await docRef.set({ isPro: true }, { merge: true });
        console.log(`✅ Pro plan activated for ${email}`);
      } else {
        console.warn(`⚠️ No user found for email: ${email}`);
      }
    } catch (error) {
      console.error("🔥 Error handling checkout.session.completed:", error);
    }
  }

  return c.json({ received: true });
});
```

**Step 3: Delete old route files**

```bash
rm src/app/api/labels/merge/route.ts
rm src/app/api/stripe/webhook/route.ts
```

**Step 4: Update frontend `/api/labels/merge` call site**

Find it:
```bash
grep -r "labels/merge" src/ --include="*.ts" --include="*.tsx"
```

Add the auth token header (same pattern as Tasks 3 & 4). The URL stays the same (`/api/labels/merge`) since the Hono path matches.

**Step 5: Start the dev server and smoke test**

```bash
npm run dev
```

- Generate a batch with multiple orders → download merged PDF → verify it opens correctly
- Verify Stripe webhook still reachable (check Stripe dashboard or use `stripe listen`)

**Step 6: Commit**

```bash
git add src/app/api/[[...route]]/route.ts
git commit -m "feat: migrate labels/merge and stripe/webhook to Hono"
```

---

### Task 6: Add Next.js middleware auth guard

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create the middleware**

This replaces the per-page `useAuthState` + redirect pattern. Create `src/middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

// Pages that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/upload", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) return NextResponse.next();

  // Check for Firebase session cookie
  // Firebase Auth uses __session cookie when using session cookies,
  // but client-side auth uses localStorage. We do a lightweight check:
  // if the user has the firebase auth cookie set, allow through.
  // The actual auth enforcement is in the API routes via token verification.
  // This middleware just prevents flash-of-unauthenticated-content.
  const sessionCookie = req.cookies.get("__session");
  if (!sessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/admin/:path*"],
};
```

**Important note:** Firebase client-side auth uses `localStorage`, not cookies, by default. This middleware provides a best-effort redirect for users who are clearly not logged in. The real auth guard remains the `useAuthState` check in each page (which handles the localStorage-based Firebase session). For a full server-side auth guard, Firebase session cookies would need to be set explicitly — that is out of scope for this plan.

**Step 2: Test**

```bash
npm run dev
```

Open an incognito window. Navigate to `http://localhost:3000/dashboard`. You should be redirected to `/login`.

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware auth guard for protected routes"
```

---

## Phase 2: UI Component Swap

### Task 7: Initialize shadcn/ui

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/ui/` (auto-generated by CLI)
- Modify: `tailwind.config.ts` or `tailwind.config.js` (if it exists; shadcn may create it)

**Step 1: Run shadcn init**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate** (or your preference)
- CSS variables: **Yes**

**Step 2: Install core components**

```bash
npx shadcn@latest add button input label card table badge separator
npx shadcn@latest add dialog select textarea
npx shadcn@latest add form
```

The `form` component requires react-hook-form and @hookform/resolvers:
```bash
npm install react-hook-form @hookform/resolvers
```

**Step 3: Verify components exist**

```bash
ls src/components/ui/
```

Expected: `button.tsx`, `input.tsx`, `card.tsx`, `table.tsx`, etc.

**Step 4: Start dev server and verify app still works**

```bash
npm run dev
```

Nothing should change visually yet — shadcn components are not used anywhere yet.

**Step 5: Commit**

```bash
git add src/components/ui/ src/app/globals.css tailwind.config.ts
git commit -m "chore: initialize shadcn/ui with core components"
```

---

### Task 8: Migrate SettingsForm to shadcn/ui + react-hook-form

**Files:**
- Modify: `src/components/SettingsForm.tsx`

**Step 1: Replace SettingsForm with react-hook-form version**

Replace the entire contents of `src/components/SettingsForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fetchUserSettings, saveUserSettings } from "@/lib/userSettings";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import toast from "react-hot-toast";

const settingsSchema = z.object({
  easypostApiKey: z.string().min(1, "API key is required"),
  envelopeCost: z.coerce.number().min(0),
  shieldCost: z.coerce.number().min(0),
  pennySleeveCost: z.coerce.number().min(0),
  topLoaderCost: z.coerce.number().min(0),
  valueThreshold: z.coerce.number().min(0),
  cardCountThreshold: z.coerce.number().min(0),
  usePennySleeves: z.boolean(),
  defaultNonMachinable: z.boolean(),
  fromAddress: z.object({
    name: z.string().min(1, "Name is required"),
    street1: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().length(2, "Use 2-letter state code"),
    zip: z.string().regex(/^\d{5}$/, "5-digit ZIP required"),
  }),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export default function SettingsForm({ user }: { user: any }) {
  const [logoUrl, setLogoUrl] = useState("");
  const [packageTypes, setPackageTypes] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      easypostApiKey: "",
      envelopeCost: 0.1,
      shieldCost: 0.1,
      pennySleeveCost: 0.02,
      topLoaderCost: 0.12,
      valueThreshold: 25,
      cardCountThreshold: 8,
      usePennySleeves: true,
      defaultNonMachinable: false,
      fromAddress: { name: "", street1: "", city: "", state: "", zip: "" },
    },
  });

  useEffect(() => {
    if (!user) return;
    fetchUserSettings(user.uid).then((settings) => {
      if (settings) {
        form.reset({
          easypostApiKey: settings.easypostApiKey || "",
          envelopeCost: settings.envelopeCost ?? 0.1,
          shieldCost: settings.shieldCost ?? 0.1,
          pennySleeveCost: settings.pennySleeveCost ?? 0.02,
          topLoaderCost: settings.topLoaderCost ?? 0.12,
          valueThreshold: settings.valueThreshold ?? 25,
          cardCountThreshold: settings.cardCountThreshold ?? 8,
          usePennySleeves: settings.usePennySleeves ?? true,
          defaultNonMachinable: settings.defaultNonMachinable ?? false,
          fromAddress: settings.fromAddress ?? { name: "", street1: "", city: "", state: "", zip: "" },
        });
        setLogoUrl(settings.logoUrl || "");
        setPackageTypes(settings.packageTypes || []);
      }
      setLoading(false);
    });
  }, [user]);

  const onSubmit = async (values: SettingsValues) => {
    await saveUserSettings(user.uid, { ...values, logoUrl, packageTypes });
    toast.success("Settings saved!");
  };

  const handleTestKey = async () => {
    const apiKey = form.getValues("easypostApiKey");
    setTestResult("⏳ Testing key...");
    try {
      const res = await fetch("/api/test-easypost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      setTestResult(data.success ? data.message : `❌ Invalid key: ${data.error}`);
    } catch {
      setTestResult("❌ Network or server error.");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const storageRef = ref(storage, `logos/${user.uid}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    setLogoUrl(url);
    toast.success("Logo uploaded!");
  };

  if (!user || loading) {
    return <div className="text-center py-10">Loading settings...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl mx-auto space-y-6 p-6">
        <h2 className="text-xl font-bold">Settings</h2>

        <Card>
          <CardHeader><CardTitle>EasyPost API Key</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="easypostApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        {...field}
                        type={showKey ? "text" : "password"}
                        placeholder="EZK_..."
                        autoComplete="off"
                      />
                      <Button type="button" variant="outline" onClick={() => setShowKey(!showKey)}>
                        {showKey ? "Hide" : "Show"}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleTestKey}>
              Test Key
            </Button>
            {testResult && <p className="text-sm text-muted-foreground">{testResult}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>From Address</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(["name", "street1", "city", "state", "zip"] as const).map((field) => (
              <FormField
                key={field}
                control={form.control}
                name={`fromAddress.${field}`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel className="capitalize">{field === "street1" ? "Street" : field}</FormLabel>
                    <FormControl>
                      <Input {...f} placeholder={field === "state" ? "e.g. WA" : field === "zip" ? "12345" : ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Shipping Thresholds</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FormField control={form.control} name="valueThreshold" render={({ field }) => (
              <FormItem>
                <FormLabel>Value Threshold ($) — orders above this ship Ground Advantage</FormLabel>
                <FormControl><Input {...field} type="number" min={0} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cardCountThreshold" render={({ field }) => (
              <FormItem>
                <FormLabel>Card Count Threshold (Non-Machinable)</FormLabel>
                <FormControl><Input {...field} type="number" min={0} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Supply Costs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["envelopeCost", "Envelope Cost ($)"],
                ["shieldCost", "Shield Cost ($)"],
                ["pennySleeveCost", "Penny Sleeve Cost ($)"],
                ["topLoaderCost", "Top Loader Cost ($)"],
              ] as const
            ).map(([name, label]) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl><Input {...field} type="number" min={0} step={0.01} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Defaults</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FormField control={form.control} name="usePennySleeves" render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4" />
                </FormControl>
                <FormLabel className="!mt-0">Use Penny Sleeves by Default</FormLabel>
              </FormItem>
            )} />
            <FormField control={form.control} name="defaultNonMachinable" render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4" />
                </FormControl>
                <FormLabel className="!mt-0">Default to Non-Machinable</FormLabel>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept="image/*" onChange={handleLogoUpload} />
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="w-32 h-auto border rounded" />
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full">Save Settings</Button>
      </form>
    </Form>
  );
}
```

**Step 2: Test in browser**

```bash
npm run dev
```

Navigate to `/dashboard/settings`. Verify:
- Form loads existing settings correctly
- Validation errors appear on blur (e.g., clear the API key field and click Save)
- Saving works and shows a toast
- Logo upload works

**Step 3: Commit**

```bash
git add src/components/SettingsForm.tsx
git commit -m "feat: migrate SettingsForm to react-hook-form + zod + shadcn/ui"
```

---

### Task 9: Migrate Dashboard page to shadcn Cards

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Replace dashboard stat cards and table with shadcn components**

Replace `src/app/dashboard/page.tsx`:

```tsx
"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import Link from "next/link";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Batch = {
  id: string;
  batchName?: string;
  createdAtMillis?: number;
  archived?: boolean;
};

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recentBatches, setRecentBatches] = useState<Batch[]>([]);
  const [labelCount, setLabelCount] = useState(0);
  const [postageTotal, setPostageTotal] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const allBatchSnap = await getDocs(
          query(collection(db, "batches"), where("userId", "==", user.uid))
        );
        const allBatchData = allBatchSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Batch, "id">),
        }));
        setBatches(allBatchData);

        const recentBatchSnap = await getDocs(
          query(
            collection(db, "batches"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(3)
          )
        );
        setRecentBatches(
          recentBatchSnap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Batch, "id">),
          }))
        );

        const orderSnap = await getDocs(
          query(collection(db, "orders"), where("userId", "==", user.uid))
        );
        let count = 0;
        let total = 0;
        orderSnap.forEach((doc) => {
          count++;
          const raw = doc.data().labelCost;
          const cost = typeof raw === "string" ? parseFloat(raw) : Number(raw);
          total += isNaN(cost) ? 0 : cost;
        });
        setLabelCount(count);
        setPostageTotal(total);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      }
    };
    fetchData();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading dashboard...
      </div>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Batches</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{batches.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Labels Generated</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{labelCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Postage Spent</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">${postageTotal.toFixed(2)}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Batches</CardTitle></CardHeader>
          <CardContent>
            {recentBatches.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent batches.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>{batch.batchName || "Untitled Batch"}</TableCell>
                      <TableCell>
                        {batch.createdAtMillis
                          ? new Date(batch.createdAtMillis).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Button variant="link" asChild className="p-0 h-auto">
                          <Link href={`/dashboard/batch/${batch.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 flex-wrap">
          <Button asChild>
            <Link href="/upload">+ Upload CSV</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/history">View History</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/settings">Settings</Link>
          </Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
```

**Step 2: Test in browser**

Navigate to `/dashboard`. Verify stats show, recent batches table renders, links work.

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: migrate dashboard to shadcn Card/Table components"
```

---

## Phase 3: Polish

### Task 10: Add Stripe subscription.deleted webhook handler

**Files:**
- Modify: `src/app/api/[[...route]]/route.ts`

**Step 1: Add handler inside the Stripe webhook route**

In the `app.post("/stripe/webhook", ...)` handler, after the `checkout.session.completed` block, add:

```ts
if (event.type === "customer.subscription.deleted") {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  try {
    // Look up user by stripeCustomerId field
    const snapshot = await adminDb
      .collection("users")
      .where("stripeCustomerId", "==", customerId)
      .get();

    const docRef = snapshot.docs[0]?.ref;
    if (docRef) {
      await docRef.set({ isPro: false, plan: "free" }, { merge: true });
      console.log(`✅ Pro revoked for customer ${customerId}`);
    } else {
      console.warn(`⚠️ No user found for stripeCustomerId: ${customerId}`);
    }
  } catch (error) {
    console.error("🔥 Error handling subscription.deleted:", error);
  }
}
```

**Step 2: Ensure `stripeCustomerId` is saved on checkout**

In the `checkout.session.completed` handler, also save the customer ID:

```ts
// In the checkout.session.completed block, change the set call to:
await docRef.set(
  { isPro: true, stripeCustomerId: session.customer as string },
  { merge: true }
);
```

**Step 3: Test with Stripe CLI**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger customer.subscription.deleted
```

Expected: console log showing `✅ Pro revoked for customer cus_...` or `⚠️ No user found`.

**Step 4: Commit**

```bash
git add src/app/api/[[...route]]/route.ts
git commit -m "feat: handle customer.subscription.deleted to revoke Pro on cancellation"
```

---

### Task 11: Consolidate dashboard's double Firestore fetch

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Replace two batch queries with one**

In the `fetchData` function, remove the `allBatchSnap` query (all batches, used only for count) and the `recentBatchSnap` query. Replace with a single query that fetches all batches ordered by date, then slice for recents:

```ts
const batchSnap = await getDocs(
  query(
    collection(db, "batches"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  )
);
const allBatchData = batchSnap.docs.map((doc) => ({
  id: doc.id,
  ...(doc.data() as Omit<Batch, "id">),
}));

setBatches(allBatchData);
setRecentBatches(allBatchData.slice(0, 3));
```

Remove the `recentBatches` state setter call that came from the old `recentBatchSnap`.

**Step 2: Test**

Navigate to dashboard, verify batch count and recent batches table both show correct data.

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "refactor: consolidate dashboard double Firestore batch fetch into one query"
```

---

### Task 12: Fix CSV parsing to handle quoted fields

**Files:**
- Find and modify the upload page that parses CSV (run `grep -r "split(\",\")" src/ --include="*.tsx" --include="*.ts"` to locate it)

**Step 1: Locate the CSV parsing code**

```bash
grep -rn "split(\",\")\|\.split(',')" src/ --include="*.tsx" --include="*.ts"
```

**Step 2: Replace manual split with PapaParse**

`papaparse` is already installed. Find the `line.split(",")` call and replace the parsing block.

Before (typical pattern):
```ts
const rows = csvText.split("\n").map(line => line.split(","));
```

After:
```ts
import Papa from "papaparse";

const result = Papa.parse<string[]>(csvText, {
  skipEmptyLines: true,
});
const rows = result.data;
```

If headers are used:
```ts
const result = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
});
const rows = result.data; // typed as Record<string, string>[]
```

**Step 3: Test with a CSV that has quoted fields containing commas**

Example CSV to test with:
```
name,address,city
"Smith, John",123 Main St,Seattle
```

Verify the name field is parsed as `Smith, John` (not split).

**Step 4: Commit**

```bash
git add <modified files>
git commit -m "fix: replace manual CSV split with PapaParse to handle quoted fields"
```
