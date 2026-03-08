"use client";

import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  if (loading || user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white px-6 py-16 flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full space-y-12 text-center">
        <div>
          <h1 className="text-5xl sm:text-6xl font-extrabold mb-4">
            📬 TCG Shipping Assistant
          </h1>
          <p className="text-lg sm:text-xl text-gray-300">
            Streamline your TCGplayer order fulfillment with smart USPS label
            generation —
            <span className="font-semibold text-yellow-300">
              {" "}
              includes PWE tracking (Ground Advantage) like eBay
            </span>
            .
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <FeatureBox text="✅ Upload TCGplayer CSVs and generate shipping labels instantly" />
          <FeatureBox text="✅ Built-in support for USPS Ground Advantage (Plain White Envelope)" />
          <FeatureBox text="✅ Tracks postage, sleeves, top loaders, and packaging costs" />
          <FeatureBox text="✅ Auto-flags high-value or thick orders for upgraded shipping" />
          <FeatureBox text="✅ Download batch summaries and tracking exports anytime" />
          <FeatureBox text="✅ Custom packaging rules based on product value and quantity" />
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded text-white font-semibold text-sm"
          >
            🔐 Login to Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureBox({ text }: { text: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-sm hover:shadow-md transition">
      <p className="text-sm text-gray-100">{text}</p>
    </div>
  );
}
