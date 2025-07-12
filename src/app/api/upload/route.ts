// /app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase";
import {
  setDoc,
  doc,
  serverTimestamp,
  getDoc,
  collection,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const orders = await req.json();
  const groundAdvantage: { url: string; tracking: string }[] = [];
  const envelopes: { url: string; tracking: string }[] = [];

  if (!orders?.length) {
    return NextResponse.json({ error: "No orders provided" }, { status: 400 });
  }

  const first = orders[0];
  const now = new Date();

  const userId = first?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userSettings = userSnap.exists() ? userSnap.data() : {};
  const userApiKey = userSettings.easypostApiKey;
  const fromAddress = userSettings.fromAddress;

  if (!userApiKey || !fromAddress) {
    return NextResponse.json(
      { error: "User settings incomplete" },
      { status: 400 }
    );
  }

  const authHeader = `Basic ${Buffer.from(userApiKey + ":").toString(
    "base64"
  )}`;

  // Usage check for hybrid billing
  const usageRef = doc(db, "usage", userId);
  const usageSnap = await getDoc(usageRef);
  const usage = usageSnap.exists() ? usageSnap.data() : { count: 0, month: "" };

  const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2025-07"
  const usageCount = usage?.month === currentMonth ? usage.count : 0;
  const isPro = userSettings?.plan === "pro";
  const newLabelCount = orders.length;

  if (!isPro && usageCount + newLabelCount > 10) {
    return NextResponse.json(
      {
        error:
          "🚫 You've hit your 10-label Free plan limit. Upgrade to Pro for unlimited labels.",
        redirect: "/dashboard/billing",
      },
      { status: 403 }
    );
  }

  // Save batch
  if (first.batchId) {
    await setDoc(
      doc(db, "batches", first.batchId),
      {
        batchName: first.batchName || "Unnamed Batch",
        createdAt: serverTimestamp(),
        createdAtMillis: now.getTime(),
        createdAtDisplay: now.toLocaleString(),
        archived: false,
        notes: "",
        userId,
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
            weight: parseFloat(customPackage.weight) || 1,
            length: customPackage.length || undefined,
            width: customPackage.width || undefined,
            height: customPackage.height || undefined,
          }
        : {
            predefined_package: isHighValue ? "Parcel" : "Letter",
            weight: isHighValue ? 3 : Math.max(1, order.weight || 1),
          };

      const createRes = await fetch("https://api.easypost.com/v2/shipments", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shipment: {
            to_address: {
              name: order.name,
              street1: order.address1,
              street2: order.address2,
              city: order.city,
              state: order.state,
              zip: order.zip?.replace(/\D/g, ""),
              country: "US",
            },
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

      let rate;
      if (isHighValue) {
        rate = shipment.rates.find(
          (r: any) => r.carrier === "USPS" && r.service === "GroundAdvantage"
        );
      }
      if (!rate) {
        rate = shipment.rates.reduce(
          (lowest: any, current: any) =>
            parseFloat(current.rate) < parseFloat(lowest?.rate || "Infinity")
              ? current
              : lowest,
          null
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
        ? userSettings.envelopeCost || 0.1
        : 0;
      const shieldCost = order.shippingShield
        ? userSettings.shieldCost || 0.1
        : 0;
      const pennyCost = order.usePennySleeve
        ? userSettings.pennySleeveCost || 0.02
        : 0;
      const loaderCost = order.useTopLoader
        ? userSettings.topLoaderCost || 0.12
        : 0;
      const labelCost = parseFloat(rate.rate || "0.63");
      const totalCost = parseFloat(
        (
          labelCost +
          envelopeCost +
          shieldCost +
          pennyCost +
          loaderCost
        ).toFixed(2)
      );

      const labelType =
        rate.service === "GroundAdvantage" ? "ground" : "envelope";

      await setDoc(doc(db, "orders", orderId), {
        userId,
        batchId: order.batchId,
        batchName: order.batchName,
        orderNumber: order.orderNumber,
        trackingCode: bought.tracking_code,
        trackingUrl: bought.tracker?.public_url || "",
        labelUrl: bought.postage_label.label_url,
        toName: order.name,
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
      console.error(`🔥 Error processing order ${order.name}:`, err);
    }
  }

  // Update usage count if user is on Free plan
  if (!isPro) {
    const newCount = usageCount + orders.length;
    await setDoc(
      usageRef,
      {
        month: currentMonth,
        count: newCount,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    console.log(
      `✅ Updated usage for ${userId}: ${newCount} labels this month`
    );
  }

  return NextResponse.json({ groundAdvantage, envelopes });
}
