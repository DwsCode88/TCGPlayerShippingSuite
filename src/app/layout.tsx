'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase';
import '@/app/globals.css';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/upload', label: 'Upload Orders' },
  { href: '/dashboard/history', label: 'History' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className="min-h-screen flex bg-white text-black">
        {/* Sidebar */}
        <aside className="w-64 h-screen bg-[#0f172a] text-white p-4 space-y-4 flex flex-col justify-between">
          <div>
            <h1 className="text-xl font-bold mb-6 flex items-center gap-2">
              📦 TCG Shipping
            </h1>
            <nav className="space-y-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`block px-4 py-2 rounded hover:bg-slate-800 ${
                    pathname === href ? 'bg-slate-700 font-semibold' : ''
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="bg-red-600 hover:bg-red-700 text-white w-full py-2 rounded text-sm font-bold"
          >
            Sign Out
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </body>
    </html>
  );
}
