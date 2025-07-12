// /app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/firebase";
import { collection, query, where, getDocs, setDoc } from "firebase/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event;
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
      return NextResponse.json({ received: true });
    }

    try {
      const userQuery = query(
        collection(db, "users"),
        where("email", "==", email)
      );
      const snapshot = await getDocs(userQuery);
      const docRef = snapshot.docs[0]?.ref;

      if (docRef) {
        await setDoc(docRef, { isPro: true }, { merge: true });
        console.log(`✅ Pro plan activated for ${email}`);
      } else {
        console.warn(`⚠️ No user found for email: ${email}`);
      }
    } catch (error) {
      console.error("🔥 Error handling checkout.session.completed:", error);
    }
  }

  return NextResponse.json({ received: true });
}
