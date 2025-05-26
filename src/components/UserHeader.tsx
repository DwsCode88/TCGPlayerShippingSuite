'use client';

import { auth } from '@/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';

export default function UserHeader() {
  const [user] = useAuthState(auth);

  if (!user) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-gray-100 text-sm">
      <span>Signed in as {user.email}</span>
      <button onClick={() => signOut(auth)} className="text-red-600 underline">Sign Out</button>
    </div>
  );
}
