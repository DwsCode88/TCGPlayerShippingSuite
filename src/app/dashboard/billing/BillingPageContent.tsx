"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";

export default function BillingPageContent() {
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
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const labelSnap = await getDocs(
        query(
          collection(db, "orders"),
          where("userId", "==", user.uid),
          where("createdAt", ">=", startOfMonth.getTime())
        )
      );
      setUsage(labelSnap.size);

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

  const isPro = plan === "Pro";
  const planName = plan;
  const usedLabels = usage;
  const limitLabels = 10;
  const progressValue = isPro ? 100 : Math.min((usedLabels / limitLabels) * 100, 100);

  return (
    <SidebarLayout>
      <div className="max-w-lg">
        {showSuccess && (
          <div className="bg-success text-white p-4 rounded shadow mb-6">
            Thank you! Your Pro subscription is now active.
          </div>
        )}

        {/* Dark card */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--deepest)" }}>
          {/* Header */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div
              className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Current Plan
            </div>
            <div className="text-xl font-bold" style={{ color: "var(--active-color)" }}>
              {planName}
            </div>
          </div>

          {/* Body - white background */}
          <div className="bg-white px-6 py-5">
            {/* Usage section */}
            <div className="mb-4">
              <div className="flex justify-between text-[13px] mb-2">
                <span style={{ color: "var(--muted-foreground)" }}>Labels used this month</span>
                <span className="font-semibold">
                  {isPro ? `${usedLabels} / ∞` : `${usedLabels} / ${limitLabels}`}
                </span>
              </div>
              <Progress value={progressValue} className="h-2">
                <ProgressTrack className="h-2">
                  <ProgressIndicator
                    style={{ backgroundColor: "var(--active-color)" }}
                  />
                </ProgressTrack>
              </Progress>
            </div>

            {/* Upgrade CTA - only if not pro */}
            {!isPro && (
              <form method="POST" action="/api/stripe/create-customer">
                <input type="hidden" name="uid" value={user.uid} />
                <input type="hidden" name="email" value={user.email || ""} />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg text-[13.5px] font-semibold text-white mt-2"
                  style={{ background: "var(--primary-color)" }}
                >
                  Upgrade to Pro ($12.99/mo)
                </button>
              </form>
            )}
            {isPro && (
              <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                You have unlimited access on the Pro plan.
              </p>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
