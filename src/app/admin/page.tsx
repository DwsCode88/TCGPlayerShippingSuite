"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

// Main Page
export default function AdminDashboard() {
  const [user] = useAuthState(auth);
  const [tab, setTab] = useState("Users");
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const snap = await getDocs(
        query(collection(db, "users"), where("__name__", "==", user.uid))
      );
      const data = snap.docs[0]?.data();
      if (!data || data.role !== "admin") {
        alert("🚫 Access denied. Admins only.");
        router.push("/");
      }
    };
    check();
  }, [user]);

  const tabs = ["Users", "Stats", "All Batches"];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-4">🛠 Admin Dashboard</h1>

      <div className="flex gap-3 mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-medium ${
              tab === t ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Users" && <AdminUsers />}
      {tab === "Stats" && <AdminStats />}
      {tab === "All Batches" && <AdminAllBatches />}
    </div>
  );
}

// Users Tab
function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(list);
    };
    fetchUsers();
  }, []);

  const toggleSuspended = async (uid: string, current: boolean) => {
    await updateDoc(doc(db, "users", uid), { suspended: !current });
    setUsers((prev) =>
      prev.map((u) => (u.id === uid ? { ...u, suspended: !current } : u))
    );
  };

  const toggleAdmin = async (uid: string, current: string) => {
    const newRole = current === "admin" ? "user" : "admin";
    await updateDoc(doc(db, "users", uid), { role: newRole });
    setUsers((prev) =>
      prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u))
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">👥 Users</h2>
      <table className="w-full text-sm border bg-white">
        <thead className="bg-gray-100 text-xs text-gray-600">
          <tr>
            <th className="p-2">UID</th>
            <th className="p-2">Role</th>
            <th className="p-2">Suspended</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t hover:bg-gray-50">
              <td className="p-2 text-xs">{u.id}</td>
              <td className="p-2">{u.role || "user"}</td>
              <td className="p-2">{u.suspended ? "Yes" : "No"}</td>
              <td className="p-2 space-x-2">
                <button
                  onClick={() => toggleSuspended(u.id, u.suspended)}
                  className="bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                >
                  {u.suspended ? "Unsuspend" : "Suspend"}
                </button>
                <button
                  onClick={() => toggleAdmin(u.id, u.role)}
                  className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                >
                  {u.role === "admin" ? "Demote" : "Promote"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stats Tab
function AdminStats() {
  return (
    <div>
      <h2 className="text-xl font-semibold">📊 Stats</h2>
      <p className="text-gray-500 mt-2">Coming soon...</p>
    </div>
  );
}

// All Batches Tab
function AdminAllBatches() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      const snap = await getDocs(collection(db, "batches"));
      const list = await Promise.all(
        snap.docs.map(async (docRef) => {
          const data = docRef.data();
          const orders = await getDocs(
            query(collection(db, "orders"), where("batchId", "==", docRef.id))
          );
          return {
            id: docRef.id,
            name: data.batchName || "Unnamed",
            userId: data.userId || "unknown",
            createdAt: data.createdAtMillis || 0,
            orderCount: orders.size,
          };
        })
      );
      setBatches(list.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    };
    fetchBatches();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">📦 All Batches</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border bg-white">
            <thead className="bg-gray-100 text-xs text-gray-600">
              <tr>
                <th className="p-2">Batch Name</th>
                <th className="p-2">User ID</th>
                <th className="p-2">Orders</th>
                <th className="p-2">Created</th>
                <th className="p-2">Link</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{b.name}</td>
                  <td className="p-2 text-xs text-gray-700">{b.userId}</td>
                  <td className="p-2">{b.orderCount}</td>
                  <td className="p-2 text-xs">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <a
                      href={`/dashboard/batch/${b.id}`}
                      target="_blank"
                      className="text-blue-600 underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
