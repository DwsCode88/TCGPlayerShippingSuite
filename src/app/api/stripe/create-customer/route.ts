// /app/api/stripe/create-customer/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const uid = form.get("uid") as string;
  const email = form.get("email") as string;

  if (!uid || !email) {
    return NextResponse.json({ error: "Missing user info" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID!,
        quantity: 1,
      },
    ],
    customer_email: email,
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?canceled=true`,
  });

  // Optional: save customer ID to Firestore
  await setDoc(
    doc(db, "users", uid),
    {
      stripeCustomerId: session.customer,
    },
    { merge: true }
  );

  return NextResponse.redirect(session.url!, 303);
}
