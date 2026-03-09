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
    <div
      style={{ background: "var(--sidebar)" }}
      className="min-h-screen flex items-center justify-center px-6"
    >
      <div className="max-w-xl w-full text-center space-y-6">
        <p
          style={{ color: "var(--active-color)", fontSize: "12px" }}
          className="uppercase tracking-widest font-medium"
        >
          TCG Shipping Suite
        </p>

        <h1 className="text-4xl font-bold text-white leading-tight">
          Ship Smarter, Not Harder
        </h1>

        <p style={{ color: "rgba(255,255,255,0.5)" }} className="text-base">
          Streamline your TCGplayer order fulfillment with smart USPS label
          generation — includes PWE tracking via Ground Advantage.
        </p>

        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/login"
            style={{ background: "var(--primary-color)" }}
            className="px-6 py-3 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition"
          >
            Get Started
          </Link>
          <Link
            href="#features"
            style={{ border: "1px solid rgba(255,255,255,0.3)" }}
            className="px-6 py-3 rounded-lg text-white font-semibold text-sm bg-transparent hover:bg-white/5 transition"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
