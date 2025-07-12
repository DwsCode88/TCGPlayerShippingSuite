// app/dashboard/billing/page.tsx
"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { doc, getDoc } from "firebase/firestore";

export default function BillingPage() {
  const [user, loading] = useAuthState(auth);
  const [usage, setUsage] = useState<number>(0);
  const [plan, setPlan] = useState<"Free" | "Pro">("Free");
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const usageRef = doc(db, "usage", user.uid);
      const usageSnap = await getDoc(usageRef);
      const usageData = usageSnap.exists() ? usageSnap.data() : null;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageCount =
        usageData?.month === currentMonth ? usageData.count || 0 : 0;

      setUsage(usageCount);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const data = userSnap.exists() ? userSnap.data() : null;

      if (data?.isPro) {
        setPlan("Pro");
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (searchParams?.get("success") === "true") {
      setShowSuccess(true);
    }
  }, [searchParams]);

  if (loading || !user) return null;

  const usageText =
    plan === "Free"
      ? `${usage} / 10 labels used this month`
      : `${usage} labels used (Unlimited plan)`;

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto py-10 px-4 text-white">
        <h1 className="text-2xl font-bold mb-6">🧾 Billing & Usage</h1>

        {showSuccess && (
          <div className="bg-green-600 text-white p-4 rounded shadow mb-6">
            ✅ Thank you! Your Pro subscription is now active.
          </div>
        )}

        <div className="bg-white text-black p-6 rounded shadow space-y-4">
          <div>
            <p className="text-sm text-gray-500">Your Plan</p>
            <p className="text-xl font-semibold">
              {plan === "Pro" ? "✅ Pro Plan Active" : "Free"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Label Usage</p>
            <p className="text-xl font-semibold">{usageText}</p>
          </div>
        </div>

        {plan === "Free" && (
          <div className="mt-8">
            <form method="POST" action="/api/stripe/create-customer">
              <input type="hidden" name="uid" value={user.uid} />
              <input type="hidden" name="email" value={user.email || ""} />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold"
              >
                🚀 Upgrade to Pro ($12.99/mo)
              </button>
            </form>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
