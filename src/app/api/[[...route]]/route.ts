import { Hono } from "hono";
import { handle } from "hono/vercel";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import { PDFDocument } from "pdf-lib";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

type Variables = {
  uid: string;
};

const app = new Hono<{ Variables: Variables }>().basePath("/api");

// ── Auth middleware (skips Stripe webhook) ───────────────────────────────────
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

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// ── Schemas ──────────────────────────────────────────────────────────────────
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

const singleLabelSchema = z.object({
  customAddress: addressSchema,
  orderNumber: z.string().optional(),
  nonMachinable: z.boolean().optional(),
  selectedPackage: packageSchema.optional(),
});

// ── POST /api/labels/batch ───────────────────────────────────────────────────
app.post(
  "/labels/batch",
  zValidator("json", z.array(orderSchema).min(1)),
  async (c) => {
    const uid = c.get("uid");
    const orders = c.req.valid("json");

    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userSettings = userSnap.exists ? userSnap.data()! : {};
    const userApiKey = userSettings.easypostApiKey as string | undefined;
    const fromAddress = userSettings.fromAddress as
      | Record<string, string>
      | undefined;

    if (!userApiKey || !fromAddress) {
      return c.json({ error: "User settings incomplete" }, 400);
    }

    const authHeader = `Basic ${Buffer.from(userApiKey + ":").toString("base64")}`;

    const usageSnap = await adminDb.collection("usage").doc(uid).get();
    const usage = usageSnap.exists
      ? usageSnap.data()!
      : { count: 0, month: "" };
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageCount =
      usage.month === currentMonth ? (usage.count as number) : 0;
    const isPro =
      userSettings.isPro === true || userSettings.plan === "pro";

    if (!isPro && usageCount + orders.length > 10) {
      return c.json(
        {
          error:
            "🚫 You've hit your 10-label Free plan limit. Upgrade to Pro for unlimited labels.",
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
      await adminDb
        .collection("batches")
        .doc(first.batchId)
        .set(
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
              predefined_package:
                customPackage.predefined_package || undefined,
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

        const createRes = await fetch(
          "https://api.easypost.com/v2/shipments",
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
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
          }
        );

        const shipment = await createRes.json();
        if (shipment.error || !shipment.rates?.length) continue;

        type Rate = { id: string; carrier: string; service: string; rate: string };
        let rate: Rate | undefined;
        if (isHighValue) {
          rate = shipment.rates.find(
            (r: Rate) => r.carrier === "USPS" && r.service === "GroundAdvantage"
          );
        }
        if (!rate) {
          rate = shipment.rates.reduce(
            (lowest: Rate | undefined, current: Rate) =>
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
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ rate }),
          }
        );

        const bought = await buyRes.json();
        if (!bought?.postage_label?.label_url) continue;

        const orderId = uuidv4();
        const envelopeCost = order.useEnvelope
          ? (userSettings.envelopeCost as number) || 0.1
          : 0;
        const shieldCost = order.shippingShield
          ? (userSettings.shieldCost as number) || 0.1
          : 0;
        const pennyCost = order.usePennySleeve
          ? (userSettings.pennySleeveCost as number) || 0.02
          : 0;
        const loaderCost = order.useTopLoader
          ? (userSettings.topLoaderCost as number) || 0.12
          : 0;
        const labelCost = parseFloat(rate.rate || "0.63");
        const totalCost = parseFloat(
          (labelCost + envelopeCost + shieldCost + pennyCost + loaderCost).toFixed(2)
        );
        const labelType =
          rate.service === "GroundAdvantage" ? "ground" : "envelope";

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

        const labelData = {
          url: bought.postage_label.label_url,
          tracking: bought.tracking_code,
        };
        if (labelType === "ground") {
          groundAdvantage.push(labelData);
        } else {
          envelopes.push(labelData);
        }
      } catch (err) {
        console.error("🔥 Error processing order:", err);
      }
    }

    if (!isPro) {
      await adminDb
        .collection("usage")
        .doc(uid)
        .set(
          {
            month: currentMonth,
            count: usageCount + orders.length,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
    }

    return c.json({ groundAdvantage, envelopes });
  }
);

// ── POST /api/labels/single ──────────────────────────────────────────────────
app.post(
  "/labels/single",
  zValidator("json", singleLabelSchema),
  async (c) => {
    const uid = c.get("uid");
    const order = c.req.valid("json");

    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userSettings = userSnap.exists ? userSnap.data()! : {};
    const userApiKey = userSettings.easypostApiKey as string | undefined;
    const fromAddress = userSettings.fromAddress as
      | Record<string, string>
      | undefined;

    if (!userApiKey || !fromAddress) {
      return c.json({ error: "User settings incomplete" }, 400);
    }

    const usageSnap = await adminDb.collection("usage").doc(uid).get();
    const usage = usageSnap.exists
      ? usageSnap.data()!
      : { count: 0, month: "" };
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageCount =
      usage.month === currentMonth ? (usage.count as number) : 0;
    const isPro =
      userSettings.isPro === true || userSettings.plan === "pro";

    if (!isPro && usageCount + 1 > 10) {
      return c.json(
        {
          error:
            "🚫 You've hit your 10-label Free plan limit. Upgrade to Pro for unlimited labels.",
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
      const createRes = await fetch(
        "https://api.easypost.com/v2/shipments",
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
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
        }
      );

      const shipment = await createRes.json();
      if (shipment.error || !shipment.rates?.length) {
        return c.json({ error: "Shipment creation failed" }, 400);
      }

      type Rate = { id: string; carrier: string; service: string; rate: string };
      const validServices = ["First", "GroundAdvantage"];
      const filteredRates = shipment.rates.filter(
        (r: Rate) => r.carrier === "USPS" && validServices.includes(r.service)
      );

      const rate = filteredRates.reduce(
        (lowest: Rate | undefined, current: Rate) =>
          parseFloat(current.rate) < parseFloat(lowest?.rate ?? "Infinity")
            ? current
            : lowest,
        undefined
      );

      if (!rate) {
        return c.json(
          { error: "No USPS First-Class or Ground Advantage rate available" },
          400
        );
      }

      const buyRes = await fetch(
        `https://api.easypost.com/v2/shipments/${shipment.id}/buy`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rate }),
        }
      );

      const bought = await buyRes.json();
      if (!bought?.postage_label?.label_url) {
        return c.json({ error: "Label purchase failed" }, 400);
      }

      const orderId = uuidv4();
      const batchId = "single-labels";

      await adminDb
        .collection("batches")
        .doc(batchId)
        .set(
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
  }
);

// ── POST /api/labels/merge ───────────────────────────────────────────────────
app.post("/labels/merge", async (c) => {
  try {
    const urls: string[] = await c.req.json();
    const mergedPdf = await PDFDocument.create();

    for (const url of urls) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      const singlePdf = await PDFDocument.load(bytes);
      const pages = await mergedPdf.copyPages(
        singlePdf,
        singlePdf.getPageIndices()
      );
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

// ── POST /api/stripe/webhook ─────────────────────────────────────────────────
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
        await docRef.set(
          { isPro: true, stripeCustomerId: session.customer as string },
          { merge: true }
        );
        console.log(`✅ Pro plan activated for ${email}`);
      } else {
        console.warn(`⚠️ No user found for email: ${email}`);
      }
    } catch (error) {
      console.error("🔥 Error handling checkout.session.completed:", error);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    try {
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

  return c.json({ received: true });
});

export { app };
export const GET = handle(app);
export const POST = handle(app);
