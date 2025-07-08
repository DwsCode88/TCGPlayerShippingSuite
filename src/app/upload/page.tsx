"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { fetchUserSettings } from "@/lib/userSettings";

type ParsedRow = {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  weight: number;
  orderNumber: string;
  valueOfProducts: number;
  nonMachinable: boolean;
  shippingShield: boolean;
  usePennySleeve: boolean;
  useTopLoader: boolean;
  useEnvelope: boolean;
  notes: string;
  packageType: string;
  selectedPackage: any | null;
  userId?: string;
  batchId?: string;
  batchName?: string;
  itemCount: number;
};

type LabelResult = {
  url: string;
  tracking: string;
};

export default function UploadPage() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [orders, setOrders] = useState<ParsedRow[]>([]);
  const [groundLabels, setGroundLabels] = useState<LabelResult[]>([]);
  const [envelopeLabels, setEnvelopeLabels] = useState<LabelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [labelsGenerated, setLabelsGenerated] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [packageTypes, setPackageTypes] = useState<any[]>([]);
  const [cardCountThreshold, setCardCountThreshold] = useState<number>(8);
  const [valueThreshold, setValueThreshold] = useState<number>(25);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user]);

  const handleCSVUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;
    if (!file) return;

    const settings = await fetchUserSettings(user.uid);
    const thresholdFromSettings = settings?.cardCountThreshold ?? 8;
    setCardCountThreshold(thresholdFromSettings);

    const threshold = settings?.valueThreshold ?? 25;
    setValueThreshold(threshold);
    const packages = settings?.packageTypes || [];
    setPackageTypes(packages);

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",");

    const getIndex = (key: string) =>
      headers.findIndex((h) =>
        h.trim().toLowerCase().includes(key.toLowerCase())
      );

    const fn = getIndex("FirstName");
    const ln = getIndex("LastName");
    const a1 = getIndex("Address1");
    const a2 = getIndex("Address2");
    const city = getIndex("City");
    const state = getIndex("State");
    const zip = getIndex("PostalCode");
    const weight = getIndex("Product Weight");
    const orderNum = getIndex("Order #");
    const valueIdx = getIndex("Value Of Products");
    const countIdx = getIndex("Item Count");

    const parsed: ParsedRow[] = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
      const value = parseFloat(values[valueIdx]) || 0;
      const count = parseInt(values[countIdx]) || 0;

      return {
        name: `${values[fn] ?? ""} ${values[ln] ?? ""}`.trim(),
        address1: values[a1],
        address2: values[a2],
        city: values[city],
        state: values[state],
        zip: values[zip],
        weight: parseFloat(values[weight]) || 1,
        orderNumber: values[orderNum],
        valueOfProducts: value,
        itemCount: count,
        nonMachinable: count >= thresholdFromSettings,
        shippingShield: false,
        usePennySleeve: true,
        useTopLoader: false,
        useEnvelope: value <= threshold,
        notes: "",
        packageType: "",
        selectedPackage: null,
      };
    });

    setOrders(parsed);
    setGroundLabels([]);
    setEnvelopeLabels([]);
    setBatchId(null);
    setLabelsGenerated(false);
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

  const generateLabels = async () => {
    if (!user || loading) return;
    setLoading(true);

    const newBatchId = uuidv4();
    const batchName = `Upload – ${new Date().toLocaleString()}`;
    const enriched = orders.map((o) => ({
      ...o,
      userId: user.uid,
      batchId: newBatchId,
      batchName,
    }));

    const res = await fetch("/api/upload", {
      method: "POST",
      body: JSON.stringify(enriched),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    setGroundLabels(data.groundAdvantage || []);
    setEnvelopeLabels(data.other || []);
    setBatchId(newBatchId);
    setLoading(false);
    setLabelsGenerated(true);
  };

  return (
    <div className="min-h-screen bg-white text-black p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">
          Upload TCGplayer Shipping CSV
        </h1>

        <form onSubmit={handleCSVUpload} className="flex flex-col items-center">
          <input
            type="file"
            name="file"
            accept=".csv"
            required
            className="mb-4 border p-2 rounded w-full max-w-md"
          />
          <button
            type="submit"
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800"
          >
            Preview Orders
          </button>
        </form>

        {orders.length > 0 && (
          <>
            <div className="overflow-x-auto mt-6">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-100 text-xs uppercase">
                  <tr>
                    <th className="p-2 text-center">#</th>
                    <th className="p-2">Order #</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Address</th>
                    <th className="p-2">City</th>
                    <th className="p-2">State</th>
                    <th className="p-2">Zip</th>
                    <th className="p-2 text-center">Weight</th>
                    <th className="p-2 text-center">Value</th>
                    <th className="p-2 text-center">Items</th>
                    <th className="p-2 text-center">Package</th>
                    <th className="p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={i} className="even:bg-gray-50">
                      <td className="p-2 text-center">{i + 1}</td>
                      <td className="p-2">{o.orderNumber}</td>
                      <td className="p-2">{o.name}</td>
                      <td className="p-2">
                        {o.address1} {o.address2}
                      </td>
                      <td className="p-2">{o.city}</td>
                      <td className="p-2">{o.state}</td>
                      <td className="p-2">{o.zip}</td>
                      <td className="p-2 text-center">{o.weight}</td>

                      {/* 🔴 Highlight value >= 25 */}
                      <td
                        className={`p-2 text-center ${
                          o.valueOfProducts >= 25
                            ? "text-red-600 font-bold"
                            : ""
                        }`}
                      >
                        ${o.valueOfProducts.toFixed(2)}
                      </td>

                      {/* 🔴 Highlight item count ≥ threshold */}
                      <td
                        className={`p-2 text-center ${
                          o.itemCount >= cardCountThreshold
                            ? "text-red-600 font-bold"
                            : ""
                        }`}
                      >
                        {o.itemCount}
                      </td>

                      <td className="p-2">
                        <select
                          className="border p-1 rounded text-xs"
                          value={o.packageType}
                          onChange={(e) => {
                            const pkgName = e.target.value;
                            const pkg = packageTypes.find(
                              (p) => p.name === pkgName
                            );
                            updateOrder(i, "packageType", pkgName);
                            updateOrder(i, "selectedPackage", pkg || null);
                          }}
                        >
                          <option value="">-- Select --</option>
                          {packageTypes.map((pkg) => (
                            <option key={pkg.name} value={pkg.name}>
                              {pkg.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full border rounded p-1"
                          value={o.notes}
                          onChange={(e) =>
                            updateOrder(i, "notes", e.target.value)
                          }
                          placeholder="optional"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-sm text-gray-600 mt-2">
                <span className="text-red-600 font-bold">Red text</span> means
                the order meets one of the following:
                <ul className="list-disc list-inside text-gray-700 pl-4 mt-1">
                  <li>
                    <span className="text-red-600 font-bold">
                      Value ≥ ${valueThreshold}
                    </span>{" "}
                    → treated as high value (non-envelope)
                  </li>
                  <li>
                    <span className="text-red-600 font-bold">
                      Item Count ≥ {cardCountThreshold}
                    </span>{" "}
                    → treated as non-machinable
                  </li>
                </ul>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow p-4 flex justify-center z-50">
              <button
                onClick={generateLabels}
                className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700"
                disabled={loading || labelsGenerated}
              >
                {loading
                  ? "Generating..."
                  : labelsGenerated
                  ? "Labels Generated"
                  : "🚀 Generate Labels"}
              </button>
            </div>
          </>
        )}

        {groundLabels.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-2">
              📦 Ground Advantage Labels
            </h2>
            <ul className="space-y-2">
              {groundLabels.map((label, i) => (
                <li key={`g-${i}`}>
                  <a
                    href={label.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Label {i + 1}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {envelopeLabels.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-2">✉️ Envelope Labels</h2>
            <ul className="space-y-2">
              {envelopeLabels.map((label, i) => (
                <li key={`e-${i}`}>
                  <a
                    href={label.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Label {i + 1}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {batchId && (
          <div className="text-center mt-6">
            <a
              href={`/dashboard/batch/${batchId}`}
              className="inline-block bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800"
            >
              🔍 View Batch and Print Postage
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
