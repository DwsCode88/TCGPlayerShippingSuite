"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";
import { Toaster } from "react-hot-toast"; // ✅ import added

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload Orders" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <html lang="en">
      <body className="flex min-h-screen text-black bg-white">
        <aside className="w-64 bg-gray-900 text-white p-4 space-y-4">
          <h2 className="text-xl font-bold mb-4">📬 TCG Shipping</h2>
          <nav className="space-y-2">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`block p-2 rounded hover:bg-gray-700 ${
                  pathname === href ? "bg-gray-800" : ""
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <hr className="my-4 border-gray-700" />
          <button
            onClick={handleSignOut}
            className="w-full text-left p-2 bg-red-600 rounded hover:bg-red-700"
          >
            🚪 Sign Out
          </button>
        </aside>
        <main className="flex-1 p-6 relative">
          {children}
          <Toaster position="top-right" /> {/* ✅ toast lives here */}
        </main>
      </body>
    </html>
  );
}
