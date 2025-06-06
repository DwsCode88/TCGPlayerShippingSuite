'use client';

import { useEffect, useState } from 'react';
import { fetchUserSettings, saveUserSettings } from '@/lib/userSettings';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/firebase';

export default function SettingsForm({ user }: { user: any }) {
  const [easypostApiKey, setEasypostApiKey] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [envelopeCost, setEnvelopeCost] = useState(0.0);
  const [shieldCost, setShieldCost] = useState(0.1);
  const [pennySleeveCost, setPennySleeveCost] = useState(0.02);
  const [topLoaderCost, setTopLoaderCost] = useState(0.12);
  const [usePennySleeves, setUsePennySleeves] = useState(true);
  const [useTopLoaders, setUseTopLoaders] = useState(true);
  const [useShippingShield, setUseShippingShield] = useState(false);
  const [defaultNonMachinable, setDefaultNonMachinable] = useState(false);
  const [fromAddress, setFromAddress] = useState({
    name: '',
    street1: '',
    city: '',
    state: '',
    zip: '',
  });

  const [showKey, setShowKey] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      const settings = await fetchUserSettings(user.uid);
      if (settings) {
        setEasypostApiKey(settings.easypostApiKey || '');
        setLogoUrl(settings.logoUrl || '');
        setEnvelopeCost(settings.envelopeCost || 0.0);
        setShieldCost(settings.shieldCost || 0.1);
        setPennySleeveCost(settings.pennySleeveCost || 0.02);
        setTopLoaderCost(settings.topLoaderCost || 0.12);
        setUsePennySleeves(settings.usePennySleeves ?? true);
        setUseTopLoaders(settings.useTopLoaders ?? true);
        setUseShippingShield(settings.useShippingShield ?? false);
        setDefaultNonMachinable(settings.defaultNonMachinable || false);
        setFromAddress(settings.fromAddress || {
          name: '',
          street1: '',
          city: '',
          state: '',
          zip: '',
        });
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
      envelopeCost,
      shieldCost,
      pennySleeveCost,
      topLoaderCost,
      usePennySleeves,
      useTopLoaders,
      useShippingShield,
      defaultNonMachinable,
      fromAddress,
    });
    alert('✅ Settings saved!');
  };

  const handleTestKey = async () => {
    setTestResult('⏳ Testing key...');
    try {
      const res = await fetch('/api/test-easypost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: easypostApiKey }),
      });

      const data = await res.json();
      setTestResult(data.success ? data.message : `❌ Invalid key: ${data.error}`);
    } catch (err) {
      setTestResult('❌ Network or server error.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const storageRef = ref(storage, `logos/${user.uid}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    setLogoUrl(url);
  };

  const updateAddressField = (field: string, value: string) => {
    setFromAddress((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!user || loading) {
    return <div className="text-center text-white py-10">Loading settings...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6 bg-gray-900 text-gray-100 rounded shadow">
      <h2 className="text-xl font-bold">⚙️ Your Settings</h2>

      {/* API Key */}
      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">EasyPost API Key</label>
        <div className="flex gap-2 items-center">
          <input
            type={showKey ? 'text' : 'password'}
            name="fake-password"
            autoComplete="new-password"
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
            value={easypostApiKey}
            placeholder="Enter EasyPost API Key"
            onChange={(e) => setEasypostApiKey(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-sm text-blue-400 underline"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <button
          onClick={handleTestKey}
          className="mt-2 text-sm bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded"
        >
          🔍 Test Key
        </button>
        {testResult && <div className="mt-2 text-sm text-yellow-300">{testResult}</div>}
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">Upload Logo</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="block w-full text-sm text-gray-300"
        />
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Uploaded logo"
            className="mt-2 w-32 h-auto border border-gray-600 rounded"
          />
        )}
      </div>

      {/* Cost Inputs */}
      {[
        { label: 'Envelope Cost', value: envelopeCost, setter: setEnvelopeCost },
        { label: 'Shipping Shield Cost', value: shieldCost, setter: setShieldCost },
        { label: 'Penny Sleeve Cost', value: pennySleeveCost, setter: setPennySleeveCost },
        { label: 'Top Loader Cost', value: topLoaderCost, setter: setTopLoaderCost },
      ].map((field, i) => (
        <div key={i}>
          <label className="block text-sm text-gray-300 font-medium mb-1">{field.label} ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={field.value}
            onChange={(e) => field.setter(parseFloat(e.target.value))}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
          />
        </div>
      ))}

      {/* Toggles */}
      {[
        { label: 'Use Penny Sleeves', value: usePennySleeves, setter: setUsePennySleeves },
        { label: 'Use Top Loaders', value: useTopLoaders, setter: setUseTopLoaders },
        { label: 'Use Shipping Shield (default)', value: useShippingShield, setter: setUseShippingShield },
        { label: 'Default to Non-Machinable', value: defaultNonMachinable, setter: setDefaultNonMachinable },
      ].map((toggle, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={toggle.value}
            onChange={(e) => toggle.setter(e.target.checked)}
            className="w-4 h-4"
          />
          <label className="text-sm text-gray-300">{toggle.label}</label>
        </div>
      ))}

      {/* From Address */}
      <div>
        <h3 className="text-lg font-semibold mt-6 mb-2">📮 From Address</h3>
        <input
          type="text"
          placeholder="Name"
          className="w-full p-2 mb-2 rounded bg-gray-800 text-white border border-gray-700"
          value={fromAddress.name}
          onChange={(e) => updateAddressField('name', e.target.value)}
        />
        <input
          type="text"
          placeholder="Street"
          className="w-full p-2 mb-2 rounded bg-gray-800 text-white border border-gray-700"
          value={fromAddress.street1}
          onChange={(e) => updateAddressField('street1', e.target.value)}
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="City"
            className="w-full p-2 mb-2 rounded bg-gray-800 text-white border border-gray-700"
            value={fromAddress.city}
            onChange={(e) => updateAddressField('city', e.target.value)}
          />
          <input
            type="text"
            placeholder="State"
            className="w-1/3 p-2 mb-2 rounded bg-gray-800 text-white border border-gray-700"
            value={fromAddress.state}
            onChange={(e) => updateAddressField('state', e.target.value)}
          />
          <input
            type="text"
            placeholder="ZIP"
            className="w-1/3 p-2 mb-2 rounded bg-gray-800 text-white border border-gray-700"
            value={fromAddress.zip}
            onChange={(e) => updateAddressField('zip', e.target.value)}
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-semibold"
      >
        💾 Save Settings
      </button>
    </div>
  );
}
