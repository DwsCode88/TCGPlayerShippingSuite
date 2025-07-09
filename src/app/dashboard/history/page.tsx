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
  const [user] = useAuthState(auth);
  const [batches, setBatches] = useState<BatchMeta[]>([]);
  const [filtered, setFiltered] = useState<BatchMeta[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

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

      const withMeta = await Promise.all(
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

      const sorted = withMeta
        .filter((b) => !b.archived)
        .sort((a, b) => b.createdAt - a.createdAt);

      setBatches(sorted);
      setFiltered(sorted.slice(0, 10));
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
    setFiltered((prev) => prev.filter((b) => b.batchId !== batchId));
  };

  const handleDateFilter = () => {
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() : Date.now();

    const result = batches.filter(
      (b) => b.createdAt >= from && b.createdAt <= to
    );

    setFiltered(result);
  };

  const resetFilter = () => {
    setDateFrom("");
    setDateTo("");
    setFiltered(showAll ? batches : batches.slice(0, 10));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">📚 Batch History</h1>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-x-2 text-sm">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border px-2 py-1 rounded"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border px-2 py-1 rounded"
          />
          <button
            onClick={handleDateFilter}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Filter
          </button>
          <button
            onClick={resetFilter}
            className="text-gray-600 hover:underline"
          >
            Reset
          </button>
        </div>

        <a
          href="/api/export-batches"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
        >
          📥 Download CSV
        </a>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm mt-6">No batches found.</p>
      ) : (
        <ul className="space-y-4 mt-4">
          {filtered.map((batch) => (
            <li
              key={batch.batchId}
              className="border bg-white dark:bg-gray-900 p-4 rounded shadow-sm flex flex-col md:flex-row md:justify-between md:items-center"
            >
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{batch.batchName}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {batch.orderCount} order{batch.orderCount > 1 ? "s" : ""} •{" "}
                  {new Date(batch.createdAt).toLocaleDateString()}
                </p>
                {batch.notes && (
                  <p className="text-xs text-gray-500 italic mt-1">
                    📝 {batch.notes}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-3 md:mt-0">
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

      {!showAll && batches.length > 10 && (
        <div className="text-center mt-4">
          <button
            onClick={() => {
              setFiltered(batches);
              setShowAll(true);
            }}
            className="text-blue-600 hover:underline text-sm"
          >
            Show All Batches ({batches.length})
          </button>
        </div>
      )}
    </div>
  );
}
