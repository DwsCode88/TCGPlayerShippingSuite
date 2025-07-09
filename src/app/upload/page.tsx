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
    localStorage.removeItem("uploadDraft");
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

        {/* Upload form */}
        {!orders.length && (
          <form
            onSubmit={handleCSVUpload}
            className="flex flex-col items-center gap-6"
          >
            <label className="border-2 border-dashed border-gray-400 bg-white w-full max-w-2xl p-8 flex flex-col items-center justify-center rounded-md hover:border-blue-500 hover:bg-blue-50 cursor-pointer">
              <UploadCloud className="w-10 h-10 text-gray-500 mb-2" />
              <span
                id="file-label"
                className="text-sm font-medium text-gray-700"
              >
                Click or drag your .csv file here
              </span>
              <input
                type="file"
                name="file"
                accept=".csv"
                required
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const label = document.getElementById("file-label");
                  if (!file) return;
                  if (!file.name.startsWith("TCGplayer_ShippingExport_")) {
                    toast.error(
                      "❌ File must start with 'TCGplayer_ShippingExport_'"
                    );
                    e.target.value = "";
                    if (label)
                      label.innerText = "Click or drag your .csv file here";
                  } else if (label) {
                    label.innerText = `📄 ${file.name}`;
                  }
                }}
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

        {/* Results / Order Table / Generate Button... */}
        {/* (Omitted here for brevity. You can paste your full results section below this comment.) */}
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
