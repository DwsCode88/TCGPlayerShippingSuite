"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";

type OrderRecord = {
  batchId: string;
  batchName: string;
  createdAt: number;
  userId: string;
};

type BatchMeta = {
  batchId: string;
  batchName: string;
  orderCount: number;
  createdAt: number;
  notes?: string;
  archived?: boolean;
};

export default function BatchHistoryPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [batches, setBatches] = useState<BatchMeta[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;

    const loadBatches = async () => {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const map = new Map<string, BatchMeta>();

      snapshot.forEach((doc) => {
        const data = doc.data() as OrderRecord;
        if (!data.batchId) return;

        if (!map.has(data.batchId)) {
          map.set(data.batchId, {
            batchId: data.batchId,
            batchName: data.batchName || "Unnamed Batch",
            createdAt: data.createdAt || 0,
            orderCount: 1,
          });
        } else {
          map.get(data.batchId)!.orderCount += 1;
        }
      });

      const withNotesAndStatus = await Promise.all(
        Array.from(map.values()).map(async (b) => {
          const batchRef = doc(db, "batches", b.batchId);
          const metaSnap = await getDoc(batchRef);
          const notes = metaSnap.exists() ? metaSnap.data().notes || "" : "";
          const archived = metaSnap.exists()
            ? metaSnap.data().archived || false
            : false;
          return { ...b, notes, archived };
        })
      );

      setBatches(
        withNotesAndStatus
          .filter((b) => !b.archived)
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    };

    loadBatches();
  }, [user]);

  const handleArchive = async (batchId: string) => {
    const confirmed = confirm(
      "Archive this batch? It will be hidden from history but not deleted."
    );
    if (!confirmed) return;

    await updateDoc(doc(db, "batches", batchId), { archived: true });
    setBatches((prev) => prev.filter((b) => b.batchId !== batchId));
  };

  if (loading || !user) return null;

  return (
    <SidebarLayout>
      <div className="max-w-5xl mx-auto p-6 text-white">
        <h1 className="text-2xl font-bold mb-4">📚 Batch History</h1>

        <div className="mb-4 text-right">
          <a
            href="/api/export-batches"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            📤 Download Full Report (CSV)
          </a>
        </div>

        {batches.length === 0 ? (
          <p>No batches found.</p>
        ) : (
          <ul className="space-y-4">
            {batches.map((batch) => (
              <li
                key={batch.batchId}
                className="border border-white/20 p-4 rounded shadow-sm flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center bg-gray-800"
              >
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-white">
                    {batch.batchName}
                  </h2>
                  <p className="text-sm text-gray-300 mb-1">
                    {batch.orderCount} order{batch.orderCount > 1 ? "s" : ""}
                  </p>
                  {batch.notes && (
                    <p className="text-xs text-gray-400 italic">
                      📝 {batch.notes}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 mt-2 sm:mt-0">
                  <Link
                    href={`/dashboard/batch/${batch.batchId}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                  >
                    View Batch
                  </Link>
                  <button
                    onClick={() => handleArchive(batch.batchId)}
                    className="bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700 text-sm"
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidebarLayout>
  );
}
