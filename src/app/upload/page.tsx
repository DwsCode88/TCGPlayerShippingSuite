'use client';

import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateOrderLabels } from '@/lib/generateOrderLabels';

type ParsedRow = {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  weight: number;
  orderNumber: string;
  nonMachinable: boolean;
  shippingShield: boolean;
  notes: string;
  valueOfProducts?: number;
  userId?: string;
  batchId?: string;
  batchName?: string;
};

type LabelResult = {
  url: string;
  tracking: string;
};

type LabelGroups = {
  groundAdvantage: LabelResult[];
  other: LabelResult[];
};

export default function UploadPage() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [orders, setOrders] = useState<ParsedRow[]>([]);
  const [labels, setLabels] = useState<LabelGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user]);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

  const handleCSVUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(Boolean);
    const headers = lines[0].split(',');

    const getIndex = (key: string) =>
      headers.findIndex((h) => h.trim().toLowerCase().includes(key.toLowerCase()));

    const fn = getIndex('FirstName');
    const ln = getIndex('LastName');
    const a1 = getIndex('Address1');
    const a2 = getIndex('Address2');
    const city = getIndex('City');
    const state = getIndex('State');
    const zip = getIndex('PostalCode');
    const weight = getIndex('Product Weight');
    const orderNum = getIndex('Order #');
    const valueIdx = getIndex('Value Of Products');

    const parsed: ParsedRow[] = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
      return {
        name: `${values[fn] ?? ''} ${values[ln] ?? ''}`.trim(),
        address1: values[a1],
        address2: values[a2],
        city: values[city],
        state: values[state],
        zip: values[zip],
        weight: parseFloat(values[weight]) || 1,
        orderNumber: values[orderNum],
        valueOfProducts: parseFloat(values[valueIdx]) || 0,
        nonMachinable: false,
        shippingShield: false,
        notes: '',
      };
    });

    setOrders(parsed);
    setLabels(null);
    setBatchId(null);
  };

  const updateOrder = <K extends keyof ParsedRow>(
    index: number,
    field: K,
    value: ParsedRow[K]
  ) => {
    const updated = [...orders];
    updated[index][field] = value;
    setOrders(updated);
  };

  const toggleAll = (field: 'nonMachinable' | 'shippingShield', value: boolean) => {
    setOrders((prev) => prev.map((o) => ({ ...o, [field]: value })));
  };

  const generateLabels = async () => {
    if (loading) {
      alert('Please wait — label generation is already in progress.');
      return;
    }

    if (!user) return;
    setLoading(true);

    const newBatchId = uuidv4();
    const batchName = `Upload – ${new Date().toLocaleString()}`;

    const enriched = orders.map((o) => ({
      ...o,
      userId: user.uid,
      batchId: newBatchId,
      batchName,
    }));

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: JSON.stringify(enriched),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    setLabels(data);
    setBatchId(newBatchId);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Upload TCGplayer Shipping CSV</h1>

        <form onSubmit={handleCSVUpload} className="mb-8 flex flex-col items-center">
          <input
            type="file"
            name="file"
            accept=".csv"
            required
            className="mb-4 border p-2 rounded w-full max-w-md"
          />
          <button type="submit" className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800">
            Preview Orders
          </button>
        </form>

        {orders.length > 0 && (
          <>
            <div className="flex gap-4 flex-wrap mb-2">
              <button onClick={() => toggleAll('nonMachinable', true)} className="text-sm border px-3 py-1 rounded">📨 All Non-Mach</button>
              <button onClick={() => toggleAll('nonMachinable', false)} className="text-sm border px-3 py-1 rounded">📨 None Non-Mach</button>
              <button onClick={() => toggleAll('shippingShield', true)} className="text-sm border px-3 py-1 rounded">🛡 All Shield</button>
              <button onClick={() => toggleAll('shippingShield', false)} className="text-sm border px-3 py-1 rounded">🛡 No Shield</button>
            </div>

            <table className="w-full border mb-6 text-sm">
              <thead className="bg-black text-white">
                <tr>
                  <th className="border px-2 py-1">#</th>
                  <th className="border px-2 py-1">Order #</th>
                  <th className="border px-2 py-1">Name</th>
                  <th className="border px-2 py-1">Address 1</th>
                  <th className="border px-2 py-1">Address 2</th>
                  <th className="border px-2 py-1">City</th>
                  <th className="border px-2 py-1">State</th>
                  <th className="border px-2 py-1">Zip</th>
                  <th className="border px-2 py-1">Weight</th>
                  <th className="border px-2 py-1">Value</th>
                  <th className="border px-2 py-1">📨</th>
                  <th className="border px-2 py-1">🛡</th>
                  <th className="border px-2 py-1">📝 Notes</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={i} className="even:bg-gray-100">
                    <td className="border px-2 py-1">{i + 1}</td>
                    <td className="border px-2 py-1">{o.orderNumber}</td>
                    <td className="border px-2 py-1">{o.name}</td>
                    <td className="border px-2 py-1">{o.address1}</td>
                    <td className="border px-2 py-1">{o.address2}</td>
                    <td className="border px-2 py-1">{o.city}</td>
                    <td className="border px-2 py-1">{o.state}</td>
                    <td className="border px-2 py-1">{o.zip}</td>
                    <td className="border px-2 py-1">{o.weight}</td>
                    <td className={`border px-2 py-1 ${o.valueOfProducts && o.valueOfProducts >= 25 ? 'text-red-600 font-bold' : ''}`}>
                      ${o.valueOfProducts?.toFixed(2) || '0.00'}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={o.nonMachinable}
                        onChange={() => updateOrder(i, 'nonMachinable', !o.nonMachinable)}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={o.shippingShield}
                        onChange={() => updateOrder(i, 'shippingShield', !o.shippingShield)}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={o.notes}
                        placeholder="optional"
                        onChange={(e) => updateOrder(i, 'notes', e.target.value)}
                        className="w-full p-1 border rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-center mt-4 mb-10 space-x-4">
              <button
                onClick={generateLabels}
                className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800"
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Labels'}
              </button>

              <button
                onClick={() => generateOrderLabels(orders.map(o => o.orderNumber))}
                className="bg-purple-700 text-white px-6 py-2 rounded hover:bg-purple-800"
              >
                🟪 Download 2x2 Order Labels
              </button>

              {loading && <p className="text-sm text-gray-600 mt-2">Generating labels... please wait.</p>}
            </div>
          </>
        )}

        {labels && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">Generated Labels</h2>

            {labels.groundAdvantage.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold">🖨 Label Printer Labels (Ground Advantage)</h3>
                <ul className="space-y-1 mb-2">
                  {labels.groundAdvantage.map((label, i) => (
                    <li key={`ga-${i}`}>
                      <a href={label.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        GA Label {i + 1}
                      </a> – <span className="text-sm text-gray-500">Tracking: {label.tracking}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={labels.groundAdvantage[0]?.url}
                  download
                  target="_blank"
                  className="inline-block bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
                >
                  ⬇ Download Ground Advantage Labels
                </a>
              </div>
            )}

            {labels.other.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold">✉️ Envelope Labels (First Class / Letter)</h3>
                <ul className="space-y-1 mb-2">
                  {labels.other.map((label, i) => (
                    <li key={`ot-${i}`}>
                      <a href={label.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        FC Label {i + 1}
                      </a> – <span className="text-sm text-gray-500">Tracking: {label.tracking}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={labels.other[0]?.url}
                  download
                  target="_blank"
                  className="inline-block bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800"
                >
                  ⬇ Download Envelope Labels
                </a>
              </div>
            )}

            {batchId && (
              <div className="text-center mt-6">
                <a
                  href={`/dashboard/batch/${batchId}`}
                  className="inline-block bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800"
                >
                  🔍 View This Batch
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
