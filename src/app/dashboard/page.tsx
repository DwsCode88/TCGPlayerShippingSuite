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
import { Badge } from "@/components/ui/badge";

type Batch = {
  id: string;
  batchName?: string;
  createdAt?: number;
  createdAtMillis?: number;
  archived?: boolean;
  userId: string;
  labelCount?: number;
  totalCost?: number;
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
    if (user) {
      const fetchData = async () => {
        try {
          const allBatchSnap = await getDocs(
            query(collection(db, "batches"), where("userId", "==", user.uid))
          );
          const allBatchData = allBatchSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Batch[];
          setBatches(allBatchData);

          const recentBatchSnap = await getDocs(
            query(
              collection(db, "batches"),
              where("userId", "==", user.uid),
              orderBy("createdAt", "desc"),
              limit(3)
            )
          );
          const recentBatchData = recentBatchSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Batch[];
          setRecentBatches(recentBatchData);

          const orderSnap = await getDocs(
            query(collection(db, "orders"), where("userId", "==", user.uid))
          );

          let count = 0;
          let total = 0;
          orderSnap.forEach((doc) => {
            count++;
            const raw = doc.data().labelCost;
            const cost =
              typeof raw === "string" ? parseFloat(raw) : Number(raw);
            total += isNaN(cost) ? 0 : cost;
          });

          setLabelCount(count);
          setPostageTotal(total);
        } catch (err) {
          console.error("Failed to fetch dashboard data:", err);
        }
      };

      fetchData();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading dashboard...
      </div>
    );
  }

  return (
    <SidebarLayout>
      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { label: "Total Batches",    value: batches.length },
          { label: "Labels Generated", value: labelCount },
          { label: "Postage Spent",    value: `$${postageTotal.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl px-5 py-5"
            style={{ background: "var(--deepest)" }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {label}
            </div>
            <div className="text-3xl font-bold text-white leading-none">{value}</div>
            <div className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              All time
            </div>
          </div>
        ))}
      </div>

      {/* Recent Batches */}
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-4 py-3 text-[13px] font-semibold border-b bg-white" style={{ borderColor: "var(--border)" }}>
          Recent Batches
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr style={{ background: "var(--stripe)" }}>
              {["Batch Name", "Date", "Labels", "Total Cost", "Status"].map(h => (
                <th
                  key={h}
                  className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-b"
                  style={{ color: "var(--muted-foreground)", borderColor: "var(--border)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentBatches.map((batch, i) => (
              <tr key={batch.id} style={{ background: i % 2 === 0 ? "#ffffff" : "var(--stripe)" }}>
                <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <Link
                    href={`/dashboard/batch/${batch.id}`}
                    className="hover:underline font-medium"
                    style={{ color: "var(--primary-color)" }}
                  >
                    {batch.batchName ?? "Untitled Batch"}
                  </Link>
                </td>
                <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                  {batch.createdAtMillis
                    ? new Date(batch.createdAtMillis).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                  {batch.labelCount ?? "—"}
                </td>
                <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                  {batch.totalCost != null ? `$${Number(batch.totalCost).toFixed(2)}` : "—"}
                </td>
                <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <Badge variant={batch.archived ? "secondary" : "default"} className="text-[11px]">
                    {batch.archived ? "Archived" : "Complete"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SidebarLayout>
  );
}
