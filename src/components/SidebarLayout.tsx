"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";
import {
  Home,
  UploadCloud,
  History,
  Settings,
  LogOut,
  CreditCard,
} from "lucide-react";

const links = [
  {
    href: "/dashboard/single-label",
    label: "Single Label",
    icon: <UploadCloud className="w-4 h-4 mr-2" />,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <Home className="w-4 h-4 mr-2" />,
  },
  {
    href: "/upload",
    label: "Upload Orders",
    icon: <UploadCloud className="w-4 h-4 mr-2" />,
  },
  {
    href: "/dashboard/history",
    label: "History",
    icon: <History className="w-4 h-4 mr-2" />,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: <Settings className="w-4 h-4 mr-2" />,
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: <CreditCard className="w-4 h-4 mr-2" />,
  },
];

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen text-white bg-gray-950">
      <aside className="w-64 bg-gray-900 p-5 hidden md:block shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-white tracking-tight">
          📬 TCG Shipping
        </h2>
        <nav className="space-y-2">
          {links.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2 rounded hover:bg-gray-800 ${
                pathname === href ? "bg-gray-800" : ""
              }`}
            >
              {icon}
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleSignOut}
          className="mt-6 flex items-center text-sm text-red-400 hover:text-red-600"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
