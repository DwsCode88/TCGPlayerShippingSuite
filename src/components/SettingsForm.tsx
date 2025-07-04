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
  const [valueThreshold, setValueThreshold] = useState<number>(0);
  const [topLoaderCost, setTopLoaderCost] = useState(0.12);
  const [usePennySleeves, setUsePennySleeves] = useState(true);
  const [defaultNonMachinable, setDefaultNonMachinable] = useState(false);
  const [fromAddress, setFromAddress] = useState({
    name: '',
    street1: '',
    city: '',
    state: '',
    zip: '',
  });
  const [packageTypes, setPackageTypes] = useState<any[]>([]);
  const [newPackage, setNewPackage] = useState({
    name: '',
    weight: 1,
    predefined_package: 'Letter',
    length: '',
    width: '',
    height: ''
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
        setDefaultNonMachinable(settings.defaultNonMachinable || false);
        setValueThreshold(typeof settings.valueThreshold === 'number' && settings.valueThreshold > 0 ? settings.valueThreshold : 25);
        setFromAddress(settings.fromAddress || {
          name: '',
          street1: '',
          city: '',
          state: '',
          zip: '',
        });
        setPackageTypes(settings.packageTypes || []);
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
      defaultNonMachinable,
      fromAddress,
      valueThreshold,
      packageTypes,
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
      if (data.success) {
        setTestResult(data.message);
      } else {
        setTestResult(`❌ Invalid key: ${data.error}`);
      }
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

  const addPackageType = () => {
    if (!newPackage.name) return;
    setPackageTypes([...packageTypes, newPackage]);
    setNewPackage({ name: '', weight: 1, predefined_package: 'Letter', length: '', width: '', height: '' });
  };

  const removePackageType = (index: number) => {
    setPackageTypes((prev) => prev.filter((_, i) => i !== index));
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

      {/* Value Threshold */}
      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1 flex items-center gap-1">
          Value Threshold
          <span className="ml-1 w-5 h-5 text-sm text-black bg-yellow-300 rounded-full flex items-center justify-center cursor-help shadow-lg hover:scale-105 transition-transform relative group">
            ?
            <span className="absolute bottom-full mb-1 w-48 text-xs text-white bg-black rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Orders with value above this will ship Ground Advantage instead of Envelope.
            </span>
          </span>
        </label>
        <input
          type="number"
          value={valueThreshold}
          onChange={(e) => setValueThreshold(Number(e.target.value))}
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
          placeholder="e.g. 20"
        />
      </div>

      {/* Costs */}
      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">Envelope Cost ($)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={envelopeCost}
          onChange={(e) => setEnvelopeCost(parseFloat(e.target.value))}
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">Shield Cost ($)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={shieldCost}
          onChange={(e) => setShieldCost(parseFloat(e.target.value))}
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">Penny Sleeve Cost ($)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={pennySleeveCost}
          onChange={(e) => setPennySleeveCost(parseFloat(e.target.value))}
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1">Top Loader Cost ($)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={topLoaderCost}
          onChange={(e) => setTopLoaderCost(parseFloat(e.target.value))}
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
        />
      </div>

      {/* Defaults */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={usePennySleeves}
          onChange={(e) => setUsePennySleeves(e.target.checked)}
          className="w-4 h-4"
        />
        <label className="text-sm text-gray-300">Use Penny Sleeves by Default</label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={defaultNonMachinable}
          onChange={(e) => setDefaultNonMachinable(e.target.checked)}
          className="w-4 h-4"
        />
        <label className="text-sm text-gray-300">Default to Non-Machinable</label>
      </div>

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

      {/* Package Types */}
      <div>
        <h3 className="text-lg font-semibold">📦 Custom Package Types</h3>
        {packageTypes.length > 0 && (
          <ul className="space-y-2">
            {packageTypes.map((pkg, i) => (
              <li key={i} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                <span className="text-sm">
                  {pkg.name} – {pkg.weight}oz – {pkg.predefined_package} – {pkg.length}" x {pkg.width}" x {pkg.height}"
                </span>
                <button
                  onClick={() => removePackageType(i)}
                  className="text-red-400 hover:underline text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-2">
          <input
            type="text"
            placeholder="Package Name"
            value={newPackage.name}
            onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Weight (oz)"
              value={newPackage.weight}
              onChange={(e) => setNewPackage({ ...newPackage, weight: parseFloat(e.target.value) })}
              className="p-2 rounded bg-gray-800 text-white border border-gray-600"
            />
            <select
              value={newPackage.predefined_package}
              onChange={(e) => setNewPackage({ ...newPackage, predefined_package: e.target.value })}
              className="p-2 rounded bg-gray-800 text-white border border-gray-600"
            >
              <option value="Letter">Letter</option>
              <option value="Parcel">Parcel</option>
              <option value="Flat">Flat</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Length (in)"
              value={newPackage.length}
              onChange={(e) => setNewPackage({ ...newPackage, length: e.target.value })}
              className="p-2 rounded bg-gray-800 text-white border border-gray-600"
            />
            <input
              type="text"
              placeholder="Width (in)"
              value={newPackage.width}
              onChange={(e) => setNewPackage({ ...newPackage, width: e.target.value })}
              className="p-2 rounded bg-gray-800 text-white border border-gray-600"
            />
            <input
              type="text"
              placeholder="Height (in)"
              value={newPackage.height}
              onChange={(e) => setNewPackage({ ...newPackage, height: e.target.value })}
              className="p-2 rounded bg-gray-800 text-white border border-gray-600"
            />
          </div>
          <button
            onClick={addPackageType}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm"
          >
            ➕ Add Package Type
          </button>
        </div>
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
