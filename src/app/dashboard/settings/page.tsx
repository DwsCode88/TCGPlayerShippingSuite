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
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      fetchUserSettings(user.uid).then((settings) => {
        if (settings) {
          setKey(settings.easypostApiKey || '');
          setLogoUrl(settings.logoUrl || '');
        }
        setLoading(false);
      });
    }
  }, [user]);

  if (!user || loading) return <p className="text-center mt-10">Loading...</p>;

  const handleSave = async () => {
    if (user) {
      await saveUserSettings(user.uid, { easypostApiKey, logoUrl });
      alert('✅ Settings saved!');
    }
  };

  return (
  <div className="max-w-xl mx-auto p-6 space-y-4 bg-gray-900 text-gray-100 rounded shadow">
    <h2 className="text-xl font-bold flex items-center gap-2">
      <span className="text-gray-300">⚙️ Your Settings</span>
    </h2>

    <label className="block font-semibold text-sm text-gray-300">
      EasyPost API Key
    </label>
    <div className="flex gap-2 items-center">
      <input
        type={showKey ? 'text' : 'password'}
        className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring focus:ring-blue-500"
        value={easypostApiKey}
        onChange={(e) => setKey(e.target.value)}
        placeholder="EasyPost API Key"
      />
      <button
        className="text-sm text-blue-400 underline hover:text-blue-300"
        onClick={() => setShowKey((prev) => !prev)}
      >
        {showKey ? 'Hide' : 'Show'}
      </button>
    </div>

    <label className="block font-semibold text-sm text-gray-300">
      Logo URL
    </label>
    <input
      className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring focus:ring-blue-500"
      value={logoUrl}
      onChange={(e) => setLogoUrl(e.target.value)}
      placeholder="https://example.com/logo.png"
    />

    <button
      className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded font-semibold flex items-center gap-2"
      onClick={handleSave}
    >
      💾 Save Settings
    </button>
  </div>
);

