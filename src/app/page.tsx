'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase';
import Link from 'next/link';

export default function HomePage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user]);

  if (loading || user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-4xl font-bold mb-4">📬 TCG Shipping Assistant</h1>
      <p className="text-center text-gray-300 mb-8">
        Streamline your TCGplayer order fulfillment with smart USPS label generation.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="bg-blue-600 px-6 py-3 rounded text-white font-semibold">
          🔐 Login to Get Started
        </Link>
        <Link href="/dashboard/settings" className="bg-gray-700 px-6 py-3 rounded text-white font-semibold">
          ⚙️ Preview Settings
        </Link>
      </div>
    </div>
  );
}
