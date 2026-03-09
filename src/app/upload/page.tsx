"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { fetchUserSettings } from "@/lib/userSettings";
import { Loader2, UploadCloud } from "lucide-react";
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
  // Per-row package/weight UI state
  rowPackage: string;
  weightLb: number;
  weightOz: number;
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
  const [isDragging, setIsDragging] = useState(false);
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
      const isEnvelope =
        parseFloat(values[getIndex("Value Of Products")]) <= threshold;
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
        useEnvelope: isEnvelope,
        notes: "",
        packageType: "",
        selectedPackage: null,
        rowPackage: "Envelope",
        weightLb: 0,
        weightOz: 0,
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

    const token = await user.getIdToken();
    const res = await fetch("/api/labels/batch", {
      method: "POST",
      body: JSON.stringify(enriched),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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
    setEnvelopeLabels(result.envelopes || []);
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

  // Update package selection for a row, syncing useEnvelope and selectedPackage
  const handlePackageChange = (index: number, pkgName: string) => {
    const updated = [...orders];
    const row = { ...updated[index] };
    row.rowPackage = pkgName;

    if (pkgName === "Envelope") {
      row.useEnvelope = true;
      row.selectedPackage = null;
      row.packageType = "";
      row.weightLb = 0;
      row.weightOz = 0;
    } else {
      const pkg = packageTypes.find((p) => p.name === pkgName) || null;
      row.useEnvelope = false;
      row.selectedPackage = pkg;
      row.packageType = pkgName;
      // If package has a pre-set weight, populate it
      if (pkg && pkg.weight) {
        const totalOz = pkg.weight;
        row.weightLb = Math.floor(totalOz / 16);
        row.weightOz = totalOz % 16;
        row.weight = totalOz;
      }
    }

    updated[index] = row;
    setOrders(updated);
  };

  // Update weight for a non-envelope row
  const handleWeightChange = (
    index: number,
    field: "weightLb" | "weightOz",
    rawValue: string
  ) => {
    const val = parseInt(rawValue) || 0;
    const updated = [...orders];
    const row = { ...updated[index] };
    row[field] = val;
    // Sync the weight field used by the API (total oz)
    const lb = field === "weightLb" ? val : row.weightLb;
    const oz = field === "weightOz" ? val : row.weightOz;
    row.weight = lb * 16 + oz;
    // Keep selectedPackage weight in sync if it exists
    if (row.selectedPackage) {
      row.selectedPackage = { ...row.selectedPackage, weight: row.weight };
    }
    updated[index] = row;
    setOrders(updated);
  };

  // Disable generate if any non-envelope row hasn't had weight explicitly confirmed
  // (lb and oz both 0 is OK — means 0 lb 0 oz which the API will floor to 1 oz)
  const canGenerate =
    orders.length > 0 &&
    orders.every(
      (o) =>
        o.rowPackage === "Envelope" ||
        (o.weightLb !== undefined && o.weightOz !== undefined)
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        color: "var(--foreground)",
        padding: "2.5rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            Batch Label Generator
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--muted-foreground)",
              marginTop: "0.25rem",
            }}
          >
            Upload your TCGplayer export CSV to preview and generate USPS
            shipping labels.
          </p>
        </div>

        {/* Drop Zone */}
        {!orders.length && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            style={{
              background: "var(--sidebar)",
              border: isDragging
                ? "2px dashed rgba(0,148,198,0.8)"
                : "2px dashed rgba(0,148,198,0.4)",
              borderRadius: "0.75rem",
              padding: "3.5rem 2rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {/* Icon */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(0,148,198,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UploadCloud size={32} color="#0094C6" />
            </div>

            {/* Text */}
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "1rem",
                  margin: 0,
                }}
              >
                Drag &amp; drop your CSV here
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: "0.8125rem",
                  margin: "0.25rem 0 0",
                }}
              >
                Must be a TCGplayer_ShippingExport_ file
              </p>
            </div>

            {/* Browse button */}
            <button
              type="button"
              style={{
                background: "var(--primary-color)",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.5rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "0.25rem",
              }}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Browse File
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {/* Order Preview Table */}
        {orders.length > 0 && (
          <>
            {/* Table */}
            <div
              style={{
                overflowX: "auto",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--card)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8125rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--muted)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {[
                      "#",
                      "Order #",
                      "Buyer",
                      "City / State",
                      "Package",
                      "Weight",
                    ].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "left",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--muted-foreground)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => {
                    const isNonEnvelope = o.rowPackage !== "Envelope";
                    return (
                      <tr
                        key={i}
                        style={{
                          background: isNonEnvelope
                            ? "rgba(0,148,198,0.08)"
                            : i % 2 === 0
                            ? "var(--background)"
                            : "var(--stripe)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {/* # */}
                        <td
                          style={{
                            padding: "0.5rem 0.75rem",
                            color: "var(--muted-foreground)",
                            width: 36,
                          }}
                        >
                          {i + 1}
                        </td>

                        {/* Order # */}
                        <td
                          style={{
                            padding: "0.5rem 0.75rem",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {o.orderNumber}
                        </td>

                        {/* Buyer */}
                        <td style={{ padding: "0.5rem 0.75rem" }}>{o.name}</td>

                        {/* City / State */}
                        <td
                          style={{
                            padding: "0.5rem 0.75rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {o.city}, {o.state}
                        </td>

                        {/* Package dropdown */}
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <select
                            value={o.rowPackage}
                            onChange={(e) =>
                              handlePackageChange(i, e.target.value)
                            }
                            style={{
                              border: "1px solid var(--border)",
                              borderRadius: "0.25rem",
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.8125rem",
                              background: "var(--background)",
                              color: "var(--foreground)",
                              cursor: "pointer",
                            }}
                          >
                            <option value="Envelope">Envelope</option>
                            {packageTypes.map((pkg) => (
                              <option key={pkg.name} value={pkg.name}>
                                {pkg.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Weight */}
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          {isNonEnvelope ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              <input
                                type="number"
                                min={0}
                                value={o.weightLb}
                                onChange={(e) =>
                                  handleWeightChange(i, "weightLb", e.target.value)
                                }
                                placeholder="lb"
                                style={{
                                  width: 52,
                                  border: "1.5px solid var(--active-color)",
                                  borderRadius: "0.25rem",
                                  padding: "0.2rem 0.4rem",
                                  fontSize: "0.8125rem",
                                  background: "rgba(255,255,255,0.9)",
                                  color: "var(--foreground)",
                                  textAlign: "center",
                                }}
                              />
                              <span
                                style={{
                                  color: "var(--muted-foreground)",
                                  fontSize: "0.75rem",
                                }}
                              >
                                /
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={15}
                                value={o.weightOz}
                                onChange={(e) =>
                                  handleWeightChange(i, "weightOz", e.target.value)
                                }
                                placeholder="oz"
                                style={{
                                  width: 52,
                                  border: "1.5px solid var(--active-color)",
                                  borderRadius: "0.25rem",
                                  padding: "0.2rem 0.4rem",
                                  fontSize: "0.8125rem",
                                  background: "rgba(255,255,255,0.9)",
                                  color: "var(--foreground)",
                                  textAlign: "center",
                                }}
                              />
                              <span
                                style={{
                                  color: "var(--muted-foreground)",
                                  fontSize: "0.75rem",
                                }}
                              >
                                oz
                              </span>
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--muted-foreground)",
                                fontSize: "0.8125rem",
                              }}
                            >
                              0 / 1 oz
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend for flagged rows */}
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {orders.some((o) => o.valueOfProducts >= valueThreshold) && (
                <p style={{ fontSize: "0.8125rem", color: "#dc2626", margin: 0 }}>
                  Rows with value &ge; ${valueThreshold} will ship via{" "}
                  <strong>USPS Ground Advantage</strong>.
                </p>
              )}
              {orders.some((o) => o.itemCount >= cardCountThreshold) && (
                <p style={{ fontSize: "0.8125rem", color: "#dc2626", margin: 0 }}>
                  Rows with {cardCountThreshold}+ items will be marked{" "}
                  <strong>Non-Machinable</strong>.
                </p>
              )}
            </div>

            {/* Action Bar */}
            {!labelsGenerated && (
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "center",
                  marginTop: "1.5rem",
                }}
              >
                <button
                  onClick={generateLabels}
                  disabled={loading || !canGenerate}
                  style={{
                    background:
                      loading || !canGenerate
                        ? "rgba(0,94,124,0.5)"
                        : "var(--primary-color)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.375rem",
                    padding: "0.625rem 1.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: loading || !canGenerate ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    transition: "background 0.15s",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={16}
                        style={{
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Generating...
                    </>
                  ) : (
                    "Generate Labels"
                  )}
                </button>

                <button
                  onClick={() => {
                    localStorage.removeItem("uploadDraft");
                    setOrders([]);
                  }}
                  style={{
                    background: "transparent",
                    color: "var(--muted-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.375rem",
                    padding: "0.625rem 1.25rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Batch link after generation */}
            {batchId && (
              <div style={{ marginTop: "2rem" }}>
                <Link
                  href={`/dashboard/batch/${batchId}`}
                  style={{
                    display: "inline-block",
                    background: "var(--primary-color)",
                    color: "#ffffff",
                    borderRadius: "0.375rem",
                    padding: "0.625rem 1.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  View Batch &amp; Print Labels
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
