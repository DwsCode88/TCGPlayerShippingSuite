'use client';

import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase';
import SettingsForm from '@/components/SettingsForm';

export default function SettingsPageWrapper() {
  const [user] = useAuthState(auth);

  if (!user) return <p className="text-center mt-10">⏳ Waiting for sign-in...</p>;

  return <SettingsForm user={user} />;
}
