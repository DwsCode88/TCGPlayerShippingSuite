"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

export default function AdminStats() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalLabelCost, setTotalLabelCost] = useState(0); // stay number
  const [topUsers, setTopUsers] = useState<{ userId: string; count: number }[]>(
    []
  );

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      setTotalUsers(usersSnap.size);

      const batchSnap = await getDocs(collection(db, "batches"));
      setTotalBatches(batchSnap.size);

      const orderSnap = await getDocs(collection(db, "orders"));
      setTotalOrders(orderSnap.size);

      let cost = 0;
      const userMap: Record<string, number> = {};

      orderSnap.forEach((doc) => {
        const data = doc.data();
        if (typeof data.labelCost === "number") {
          cost += data.labelCost;
        }
        if (data.userId) {
          userMap[data.userId] = (userMap[data.userId] || 0) + 1;
        }
      });

      setTotalLabelCost(Number(cost.toFixed(2))); // ✅ fix here

      const top = Object.entries(userMap)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopUsers(top);
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">📊 Admin Stats</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={totalUsers} />
        <StatCard label="Total Batches" value={totalBatches} />
        <StatCard label="Total Orders" value={totalOrders} />
        <StatCard
          label="Total Label Cost"
          value={`$${totalLabelCost.toFixed(2)}`}
        />
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">👑 Top Users by Orders</h3>
        {topUsers.length === 0 ? (
          <p className="text-sm text-gray-500">No data available.</p>
        ) : (
          <ul className="list-disc list-inside text-sm text-gray-200">
            {topUsers.map((u) => (
              <li key={u.userId}>
                <span className="font-mono">{u.userId}</span>: {u.count} orders
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border shadow rounded p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
