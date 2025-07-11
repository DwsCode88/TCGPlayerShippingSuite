"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { fetchUserSettings } from "@/lib/userSettings";
import { FileUp, Loader2, UploadCloud } from "lucide-react";
import { toast } from "react-hot-toast";
import SidebarLayout from "@/components/SidebarLayout";
import Link from "next/link";

type PackageType = {
  name: string;
  weight: number;
  predefined_package: string;
  length?: string;
  width?: string;
  height?: string;
};

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
  itemCount: number;
  nonMachinable: boolean;
  shippingShield: boolean;
  usePennySleeve: boolean;
  useTopLoader: boolean;
  useEnvelope: boolean;
  notes: string;
  packageType: string;
  selectedPackage: PackageType | null;
};

type LabelResult = {
  url: string;
  tracking: string;
};

function UploadContent() {
  const [user] = useAuthState(auth);
  const router = useRouter();

  const [orders, setOrders] = useState<ParsedRow[]>([]);
  const [groundLabels, setGroundLabels] = useState<LabelResult[]>([]);
  const [envelopeLabels, setEnvelopeLabels] = useState<LabelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [labelsGenerated, setLabelsGenerated] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [packageTypes, setPackageTypes] = useState<PackageType[]>([]);
  const [cardCountThreshold, setCardCountThreshold] = useState(8);
  const [valueThreshold, setValueThreshold] = useState(25);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredOnce = useRef(false);

  useEffect(() => {
    if (!user || restoredOnce.current) return;
    const saved = localStorage.getItem("uploadDraft");
    if (saved && !orders.length) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
          setOrders(parsed.data);
          restoredOnce.current = true;
          toast.success("✅ Restored previous session");
        }
      } catch (err) {
        console.warn("Failed to parse saved uploadDraft");
      }
    }
  }, [user]);

  const handleFile = async (file: File) => {
    if (!user || !file) return;

    if (!file.name.startsWith("TCGplayer_ShippingExport_")) {
      toast.error("❌ File must start with 'TCGplayer_ShippingExport_'");
      return;
    }

    const settings = await fetchUserSettings(user.uid);
    const thresholdFromSettings = settings?.cardCountThreshold ?? 8;
    const threshold = settings?.valueThreshold ?? 25;
    const packages = settings?.packageTypes || [];
    setCardCountThreshold(thresholdFromSettings);
    setValueThreshold(threshold);
    setPackageTypes(packages);

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",");

    const getIndex = (key: string) =>
      headers.findIndex((h) =>
        h.trim().toLowerCase().includes(key.toLowerCase())
      );

    const parsed: ParsedRow[] = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
      return {
        name: `${values[getIndex("FirstName")] ?? ""} ${
          values[getIndex("LastName")] ?? ""
        }`.trim(),
        address1: values[getIndex("Address1")],
        address2: values[getIndex("Address2")],
        city: values[getIndex("City")],
        state: values[getIndex("State")],
        zip: values[getIndex("PostalCode")],
        weight: parseFloat(values[getIndex("Product Weight")]) || 1,
        orderNumber: values[getIndex("Order #")],
        valueOfProducts: parseFloat(values[getIndex("Value Of Products")]) || 0,
        itemCount: parseInt(values[getIndex("Item Count")]) || 0,
        nonMachinable:
          parseInt(values[getIndex("Item Count")]) >= thresholdFromSettings,
        shippingShield: false,
        usePennySleeve: true,
        useTopLoader: false,
        useEnvelope:
          parseFloat(values[getIndex("Value Of Products")]) <= threshold,
        notes: "",
        packageType: "",
        selectedPackage: null,
      };
    });

    setOrders(parsed);
    localStorage.setItem(
      "uploadDraft",
      JSON.stringify({ name: new Date().toISOString(), data: parsed })
    );
    setGroundLabels([]);
    setEnvelopeLabels([]);
    setBatchId(null);
    setLabelsGenerated(false);
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

    const result = await res.json();

    if (!res.ok) {
      if (res.status === 403 && result?.redirect) {
        toast.error(result.error || "Free plan limit reached.");
        router.push(result.redirect);
      } else {
        toast.error(result.error || "Something went wrong.");
      }
      setLoading(false);
      return;
    }

    setGroundLabels(result.groundAdvantage || []);
    setEnvelopeLabels(result.other || []);
    setBatchId(newBatchId);
    setLoading(false);
    setLabelsGenerated(true);
    localStorage.removeItem("uploadDraft");
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

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            📦 TCGplayer CSV Label Generator
          </h1>
          <p className="text-gray-600 mt-2">
            Upload your orders, preview rates, and print USPS shipping labels
            fast.
          </p>
        </div>

        {!orders.length && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const file = (
                e.currentTarget.elements.namedItem("file") as HTMLInputElement
              )?.files?.[0];
              if (file) handleFile(file);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className="flex flex-col items-center gap-6"
          >
            <label className="border-2 border-dashed border-gray-400 bg-white w-full max-w-2xl p-8 flex flex-col items-center justify-center rounded-md hover:border-blue-500 hover:bg-blue-50 cursor-pointer">
              <UploadCloud className="w-10 h-10 text-gray-500 mb-2" />
              <span className="text-sm font-medium text-gray-700">
                Click or drag your .csv file here
              </span>
              <input
                type="file"
                name="file"
                accept=".csv"
                required
                className="hidden"
              />
            </label>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-medium shadow-md"
            >
              <FileUp className="inline-block w-4 h-4 mr-2" /> Preview Orders
            </button>
          </form>
        )}

        {orders.length > 0 && (
          <>
            <div className="text-right mb-4">
              <button
                onClick={() => {
                  localStorage.removeItem("uploadDraft");
                  setOrders([]);
                }}
                className="text-sm text-red-600 hover:underline"
              >
                🗑 Discard Draft
              </button>
            </div>

            <div className="overflow-x-auto rounded shadow bg-white">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Order #</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">City</th>
                    <th className="p-2">State</th>
                    <th className="p-2">Zip</th>
                    <th className="p-2">Weight</th>
                    <th className="p-2">Value</th>
                    <th className="p-2">Items</th>
                    <th className="p-2">Package</th>
                    <th className="p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={i} className="even:bg-gray-50">
                      <td className="p-2 text-center">{i + 1}</td>
                      <td className="p-2">{o.orderNumber}</td>
                      <td className="p-2">{o.name}</td>
                      <td className="p-2">{o.city}</td>
                      <td className="p-2">{o.state}</td>
                      <td className="p-2">{o.zip}</td>
                      <td className="p-2 text-center">{o.weight}</td>
                      <td
                        className={`p-2 text-center ${
                          o.valueOfProducts >= valueThreshold
                            ? "text-red-600 font-bold"
                            : ""
                        }`}
                      >
                        ${o.valueOfProducts.toFixed(2)}
                      </td>
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
                          className="border rounded p-1 text-xs"
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
            </div>

            <div className="mt-2 space-y-1">
              {orders.some((o) => o.valueOfProducts >= valueThreshold) && (
                <p className="text-sm text-red-600">
                  🔴 Rows highlighted in red indicate orders that will ship via{" "}
                  <strong>USPS Ground Advantage</strong> due to high item value.
                </p>
              )}
              {orders.some((o) => o.itemCount >= cardCountThreshold) && (
                <p className="text-sm text-red-600">
                  🔴 Rows highlighted in red indicate orders that will be marked{" "}
                  <strong>Non-Machinable</strong> due to card count.
                </p>
              )}
            </div>

            {!labelsGenerated && (
              <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow p-4 flex justify-center z-50">
                <button
                  onClick={generateLabels}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded shadow-md font-medium flex items-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" /> Generating...
                    </>
                  ) : (
                    "🚀 Generate Labels"
                  )}
                </button>
              </div>
            )}

            {batchId && (
              <div className="text-center mt-12">
                <Link
                  href={`/dashboard/batch/${batchId}`}
                  className="inline-block bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded font-medium"
                >
                  🔍 View Batch & Print Labels
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function UploadPageWrapper() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <SidebarLayout>
      <UploadContent />
    </SidebarLayout>
  );
}
