import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const [order] = await req.json();

  if (!order?.userId || !order?.customAddress) {
    return NextResponse.json(
      { error: "Missing userId or address" },
      { status: 400 }
    );
  }

  const userRef = doc(db, "users", order.userId);
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

  const usageRef = doc(db, "usage", order.userId);
  const usageSnap = await getDoc(usageRef);
  const usage = usageSnap.exists() ? usageSnap.data() : { count: 0, month: "" };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageCount = usage?.month === currentMonth ? usage.count : 0;

  const isPro = userSettings?.isPro === true || userSettings?.plan === "pro";

  if (!isPro && usageCount + 1 > 10) {
    return NextResponse.json(
      {
        error:
          "🚫 You've hit your 10-label Free plan limit. Upgrade to Pro for unlimited labels.",
        redirect: "/dashboard/billing",
      },
      { status: 403 }
    );
  }

  const authHeader = `Basic ${Buffer.from(userApiKey + ":").toString(
    "base64"
  )}`;

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
        weight: parseFloat(customPackage.weight) || 1,
        length: customPackage.length || undefined,
        width: customPackage.width || undefined,
        height: customPackage.height || undefined,
      }
    : {
        predefined_package: "Letter",
        weight: 1,
      };

  try {
    const createRes = await fetch("https://api.easypost.com/v2/shipments", {
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
    });

    const shipment = await createRes.json();

    if (shipment.error || !shipment.rates?.length) {
      return NextResponse.json(
        { error: "Shipment creation failed" },
        { status: 400 }
      );
    }

    // ✅ Filter for USPS First or GroundAdvantage
    const validServices = ["First", "GroundAdvantage"];
    const filteredRates = shipment.rates.filter(
      (r: any) => r.carrier === "USPS" && validServices.includes(r.service)
    );

    const rate = filteredRates.reduce(
      (lowest: any, current: any) =>
        parseFloat(current.rate) < parseFloat(lowest?.rate || "Infinity")
          ? current
          : lowest,
      null
    );

    if (!rate) {
      return NextResponse.json(
        { error: "No USPS First-Class or Ground Advantage rate available" },
        { status: 400 }
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
      return NextResponse.json(
        { error: "Label purchase failed" },
        { status: 400 }
      );
    }

    const batchId = "single-labels";
    const orderId = uuidv4();

    await setDoc(
      doc(db, "batches", batchId),
      {
        batchName: "Single Labels",
        userId: order.userId,
        createdAt: serverTimestamp(),
        archived: false,
        notes: "Auto-generated for single-labels",
      },
      { merge: true }
    );

    await setDoc(doc(db, "orders", orderId), {
      userId: order.userId,
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
      await setDoc(
        usageRef,
        {
          month: currentMonth,
          count: usageCount + 1,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      labelUrl: bought.postage_label.label_url,
      trackingCode: bought.tracking_code,
    });
  } catch (err: any) {
    console.error("🔥 Error creating label:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
