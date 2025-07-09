"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import toast from "react-hot-toast";

type UserMeta = {
  uid: string;
  email?: string;
  role?: string;
  suspended?: boolean;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list: UserMeta[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          uid: docSnap.id,
          email: data.email || "",
          role: data.role || "user",
          suspended: data.suspended || false,
        });
      });

      setUsers(list);
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const toggleSuspend = async (uid: string, current: boolean) => {
    await updateDoc(doc(db, "users", uid), { suspended: !current });
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, suspended: !current } : u))
    );
    toast.success(`User ${!current ? "suspended" : "unsuspended"}`);
  };

  const handleDelete = async (uid: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    await deleteDoc(doc(db, "users", uid));
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
    toast.success("User deleted");
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🧑‍💼 All Users</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto border rounded shadow">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-xs text-gray-600 uppercase">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t">
                  <td className="p-3">{u.email || u.uid}</td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3">
                    {u.suspended ? (
                      <span className="text-red-600 font-semibold">
                        Suspended
                      </span>
                    ) : (
                      <span className="text-green-600 font-semibold">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="p-3 space-x-2">
                    <button
                      onClick={() => toggleSuspend(u.uid, u.suspended || false)}
                      className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                    >
                      {u.suspended ? "Unsuspend" : "Suspend"}
                    </button>
                    <button
                      onClick={() => handleDelete(u.uid)}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
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
