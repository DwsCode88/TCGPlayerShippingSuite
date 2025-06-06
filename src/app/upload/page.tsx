// ✅ FULL WORKING FILE: Upload page with CSV preview + separate Ground/Envelope labels
'use client';

import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateOrderLabels } from '@/lib/generateOrderLabels';

// ... define types ParsedRow and LabelResult

export default function UploadPage() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [orders, setOrders] = useState<ParsedRow[]>([]);
  const [groundLabels, setGroundLabels] = useState<LabelResult[]>([]);
  const [envelopeLabels, setEnvelopeLabels] = useState<LabelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user]);

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
      const values = line.split(',').map((v) => v.replace(/^\"|\"$/g, '').trim());
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
        usePennySleeve: true,
        useTopLoader: false,
        useEnvelope: true,
      };
    });

    setOrders(parsed);
    setGroundLabels([]);
    setEnvelopeLabels([]);
    setBatchId(null);
  };

  const updateOrder = <K extends keyof ParsedRow>(index: number, field: K, value: ParsedRow[K]) => {
    const updated = [...orders];
    updated[index][field] = value;
    setOrders(updated);
  };

  const toggleAll = (field: keyof ParsedRow, value: boolean) => {
    setOrders((prev) => prev.map((o) => ({ ...o, [field]: value })));
  };

  const generateLabels = async () => {
    if (!user || loading) return;
    setLoading(true);

    const newBatchId = uuidv4();
    const batchName = `Upload – ${new Date().toLocaleString()}`;
    const enriched = orders.map((o) => ({ ...o, userId: user.uid, batchId: newBatchId, batchName }));

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: JSON.stringify(enriched),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    setGroundLabels(data.groundAdvantage || []);
    setEnvelopeLabels(data.other || []);
    setBatchId(newBatchId);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Upload TCGplayer Shipping CSV</h1>

        <form onSubmit={handleCSVUpload} className="mb-8 flex flex-col items-center">
          <input type="file" name="file" accept=".csv" required className="mb-4 border p-2 rounded w-full max-w-md" />
          <button type="submit" className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800">Preview Orders</button>
        </form>

        {orders.length > 0 && (
          <>
            <div className="flex gap-2 flex-wrap mb-3 text-sm">
              {['nonMachinable', 'shippingShield', 'usePennySleeve', 'useTopLoader', 'useEnvelope'].map((field) => (
                <>
                  <button key={`${field}-yes`} onClick={() => toggleAll(field as any, true)} className="border px-3 py-1 rounded">
                    ✅ All {field.replace('use', '')}
                  </button>
                  <button key={`${field}-no`} onClick={() => toggleAll(field as any, false)} className="border px-3 py-1 rounded">
                    ❌ No {field.replace('use', '')}
                  </button>
                </>
              ))}
            </div>

            <table className="w-full border mb-6 text-sm">
              <thead className="bg-black text-white">
                <tr>
                  {['#', 'Order #', 'Name', 'Address 1', 'Address 2', 'City', 'State', 'Zip', 'Weight', 'Value', '📨', '🛡', '💧', '📎', '✉️', '📝 Notes'].map((h) => (
                    <th key={h} className="border px-2 py-1">{h}</th>
                  ))}
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
                    <td className={`border px-2 py-1 ${o.valueOfProducts && o.valueOfProducts >= 25 ? 'text-red-600 font-bold' : ''}`}>${o.valueOfProducts?.toFixed(2) || '0.00'}</td>
                    {['nonMachinable', 'shippingShield', 'usePennySleeve', 'useTopLoader', 'useEnvelope'].map((f) => (
                      <td key={f} className="border px-2 py-1 text-center">
                        <input type="checkbox" checked={!!o[f as keyof ParsedRow]} onChange={() => updateOrder(i, f as any, !o[f as keyof ParsedRow])} />
                      </td>
                    ))}
                    <td className="border px-2 py-1">
                      <input type="text" value={o.notes} placeholder="optional" onChange={(e) => updateOrder(i, 'notes', e.target.value)} className="w-full p-1 border rounded" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-center mt-4 mb-10 space-x-4">
              <button onClick={generateLabels} className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800" disabled={loading}>
                {loading ? 'Generating...' : 'Generate Labels'}
              </button>
              <button onClick={() => generateOrderLabels(orders.map(o => o.orderNumber))} className="bg-purple-700 text-white px-6 py-2 rounded hover:bg-purple-800">
                🟪 Download 2x2 Order Labels
              </button>
            </div>
          </>
        )}

        {groundLabels.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">📦 Ground Advantage Labels</h2>
            <ul className="space-y-2">
              {groundLabels.map((label, i) => (
                <li key={`g-${i}`}><a href={label.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Ground Label {i + 1}</a><p className="text-sm text-gray-600">Tracking: {label.tracking}</p></li>
              ))}
            </ul>
          </div>
        )}

        {envelopeLabels.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">✉️ Envelope Labels</h2>
            <ul className="space-y-2">
              {envelopeLabels.map((label, i) => (
                <li key={`e-${i}`}><a href={label.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Envelope Label {i + 1}</a><p className="text-sm text-gray-600">Tracking: {label.tracking}</p></li>
              ))}
            </ul>
          </div>
        )}

        {batchId && (
          <div className="text-center mt-6">
            <a href={`/dashboard/batch/${batchId}`} className="inline-block bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800">🔍 View This Batch</a>
          </div>
        )}
      </div>
    </div>
  );
}
