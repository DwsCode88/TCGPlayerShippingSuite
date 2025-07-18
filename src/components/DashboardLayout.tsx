'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/upload', label: 'Upload Orders' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900 text-white p-4 space-y-4">
        <h2 className="text-xl font-bold mb-4">📬 TCG Shipping</h2>
        <nav className="space-y-2">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block p-2 rounded hover:bg-gray-700 ${
                pathname === href ? 'bg-gray-800' : ''
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
      <main className="flex-1 p-6 bg-white text-black">{children}</main>
    </div>
  );
}
