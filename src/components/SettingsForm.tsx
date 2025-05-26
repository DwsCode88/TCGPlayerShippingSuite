'use client';

import { useEffect, useState } from 'react';
import { fetchUserSettings, saveUserSettings } from '@/lib/userSettings';

export default function SettingsForm({ user }: { user: any }) {
  const [easypostApiKey, setEasypostApiKey] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [showKey, setShowKey] = useState(true); // show by default to avoid autofill injection
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      const settings = await fetchUserSettings(user.uid);
      console.log('🔥 Fetched settings from Firestore:', settings);
      if (settings) {
        setEasypostApiKey(settings.easypostApiKey || '');
        setLogoUrl(settings.logoUrl || '');
      }
      setLoading(false);
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    await saveUserSettings(user.uid, {
      easypostApiKey,
      logoUrl,
    });
    alert('✅ Settings saved!');
  };

  if (!user || loading) {
    return <div className="text-center text-white py-10">Loading settings...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4 bg-gray-900 text-gray-100 rounded shadow">
      <h2 className="text-xl font-bold">⚙️ Your Settings</h2>

      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">EasyPost API Key</label>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            name="fake-password"
            autoComplete="new-password"
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
            value={easypostApiKey}
            placeholder="Enter EasyPost API Key"
            onFocus={() => console.log('📌 INPUT FOCUSED:', easypostApiKey)}
            onBlur={() => console.log('📤 INPUT BLURRED:', easypostApiKey)}
            onChange={(e) => {
              console.log('✏️ CHANGED TO:', e.target.value);
              setEasypostApiKey(e.target.value);
            }}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-sm text-blue-400 underline"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">Logo URL</label>
        <input
          type="text"
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
          value={logoUrl}
          placeholder="https://yourdomain.com/logo.png"
          onChange={(e) => setLogoUrl(e.target.value)}
        />
      </div>

      <button
        onClick={handleSave}
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-semibold"
      >
        💾 Save Settings
      </button>
    </div>
  );
}
