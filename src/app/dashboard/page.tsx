'use client';

import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import Link from 'next/link';

export default function DashboardPage() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [labelCount, setLabelCount] = useState(0);
  const [postageTotal, setPostageTotal] = useState(0);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user]);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          // 🔹 Fetch all batches for total count
          const allBatchSnap = await getDocs(
            query(collection(db, 'batches'), where('userId', '==', user.uid))
          );
          const allBatchData = allBatchSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setBatches(allBatchData);

          // 🔹 Fetch recent 3 batches
          const recentBatchSnap = await getDocs(
            query(
              collection(db, 'batches'),
              where('userId', '==', user.uid),
              orderBy('createdAt', 'desc'),
              limit(3)
            )
          );
          const recentBatchData = recentBatchSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setRecentBatches(recentBatchData);

          // 🔹 Fetch orders to calculate totals
          const orderSnap = await getDocs(
            query(collection(db, 'orders'), where('userId', '==', user.uid))
          );

          let count = 0;
          let total = 0;
          orderSnap.forEach((doc) => {
            count++;
            const raw = doc.data().labelCost;
            const cost = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
            total += isNaN(cost) ? 0 : cost;
          });

          setLabelCount(count);
          setPostageTotal(total);
        } catch (err) {
          console.error('Failed to fetch dashboard data:', err);
        }
      };

      fetchData();
    }
  }, [user]);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 text-white">
      <h1 className="text-2xl font-bold mb-6">📊 Dashboard Overview</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white text-black rounded shadow p-4">
          <p className="text-sm text-gray-500">Total Batches</p>
          <p className="text-xl font-bold">{batches.length}</p>
        </div>
        <div className="bg-white text-black rounded shadow p-4">
          <p className="text-sm text-gray-500">Labels Generated</p>
          <p className="text-xl font-bold">{labelCount}</p>
        </div>
        <div className="bg-white text-black rounded shadow p-4">
          <p className="text-sm text-gray-500">Postage Spent</p>
          <p className="text-xl font-bold">${postageTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Recent Batches */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">📁 Recent Batches</h2>
        {recentBatches.length === 0 ? (
          <p className="text-gray-400">No recent batches.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full border border-white/20 text-sm">
              <thead className="bg-white text-black">
                <tr>
                  <th className="px-3 py-2 border">Batch Name</th>
                  <th className="px-3 py-2 border">Created At</th>
                  <th className="px-3 py-2 border">View</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((batch) => (
                  <tr key={batch.id} className="border-t border-white/10 text-center">
                    <td className="px-3 py-2 border">{batch.batchName || 'Untitled Batch'}</td>
                    <td className="px-3 py-2 border">
                      {batch.createdAtMillis
                        ? new Date(batch.createdAtMillis).toLocaleString()
                        : 'N/A'}
                    </td>
                    <td className="px-3 py-2 border">
                      <Link
                        href={`/dashboard/batch/${batch.id}`}
                        className="text-blue-500 hover:underline"
                      >
                        View Batch
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 flex-wrap">
        <Link
          href="/upload"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Upload CSV
        </Link>
        <Link
          href="/dashboard/history"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📜 View History
        </Link>
        <Link
          href="/dashboard/settings"
          className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          ⚙️ Settings
        </Link>
      </div>
    </div>
  );
}
