"use client";

import { useState } from "react";
import AdminUsers from "./AdminUsers";
import AdminStats from "./AdminStats";

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<"users" | "stats">("users");

  return (
    <div className="max-w-7xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">🛠 Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-700 mb-6">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 rounded-t ${
            tab === "users"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setTab("stats")}
          className={`px-4 py-2 rounded-t ${
            tab === "stats"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
        >
          Stats
        </button>
      </div>

      {/* Content */}
      <div className="mt-4">
        {tab === "users" && <AdminUsers />}
        {tab === "stats" && <AdminStats />}
      </div>
    </div>
  );
}
