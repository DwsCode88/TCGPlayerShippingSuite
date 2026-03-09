"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";
import {
  Home,
  UploadCloud,
  FileText,
  History,
  Settings,
  CreditCard,
  LogOut,
  User,
} from "lucide-react";

const links = [
  { href: "/dashboard",              label: "Dashboard",     icon: Home },
  { href: "/upload",                 label: "Upload Orders", icon: UploadCloud },
  { href: "/dashboard/single-label", label: "Single Label",  icon: FileText },
  { href: "/dashboard/history",      label: "History",       icon: History },
  { href: "/dashboard/settings",     label: "Settings",      icon: Settings },
  { href: "/dashboard/billing",      label: "Billing",       icon: CreditCard },
];

export default function SidebarLayout({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className="w-[220px] min-w-[220px] hidden md:flex flex-col"
        style={{ background: "var(--sidebar)" }}
      >
        {/* Brand */}
        <div
          className="px-5 py-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-2xl font-bold text-white leading-tight tracking-tight">
            TCG Shipping
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            Shipping Suite
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors"
                style={{
                  borderLeft: active ? "3px solid #0094C6" : "3px solid transparent",
                  background: active ? "rgba(0,148,198,0.15)" : "transparent",
                }}
              >
                <Icon className="w-4 h-4" style={{ opacity: active ? 1 : 0.7 }} />
                {label}
              </Link>
            );
          })}

          {/* Admin (conditional) */}
          {isAdmin && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8 }}>
              <Link
                href="/admin"
                className="flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] font-medium text-white"
                style={{
                  borderLeft: pathname.startsWith("/admin") ? "3px solid #0094C6" : "3px solid transparent",
                  background: pathname.startsWith("/admin") ? "rgba(0,148,198,0.15)" : "transparent",
                }}
              >
                <User className="w-4 h-4" style={{ opacity: 0.7 }} />
                Admin
                <span
                  className="ml-auto text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(0,148,198,0.3)", color: "#0094C6" }}
                >
                  Admin
                </span>
              </Link>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-[13px]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-background p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
