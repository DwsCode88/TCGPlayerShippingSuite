'use client';

import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchUserSettings, saveUserSettings } from '@/lib/userSettings';

export default function SettingsPage() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [easypostApiKey, setKey] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      fetchUserSettings(user.uid).then((settings) => {
        if (settings) {
          setKey(settings.easypostApiKey);
          setLogoUrl(settings.logoUrl);
        }
      });
    }
  }, [user]);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

  const handleSave = async () => {
    if (user) {
      await saveUserSettings(user.uid, { easypostApiKey, logoUrl });
      alert('Settings saved!');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2 className="text-lg font-bold">⚙️ Your Settings</h2>
      <input
        className="w-full p-2 border"
        value={easypostApiKey}
        onChange={(e) => setKey(e.target.value)}
        placeholder="EasyPost API Key"
      />
      <input
        className="w-full p-2 border"
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
        placeholder="Logo URL"
      />
      <button className="bg-blue-600 text-white p-2 rounded" onClick={handleSave}>
        Save Settings
      </button>
    </div>
  );
}
