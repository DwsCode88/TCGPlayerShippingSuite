"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase";
import { fetchUserSettings } from "@/lib/userSettings";
import SidebarLayout from "@/components/SidebarLayout";

const inputStyle: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid var(--sidebar)",
  borderRadius: "6px",
  padding: "6px 10px",
  fontSize: "13px",
  color: "#1a2332",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  color: "var(--muted-foreground)",
  fontSize: "12px",
  fontWeight: 600,
  marginBottom: "4px",
  display: "block",
};

const focusClass =
  "focus:outline-none focus:ring-2 focus:ring-[var(--active-color)] focus:ring-offset-0";

export default function SingleLabelPage() {
  const [user] = useAuthState(auth);

  const [rawInput, setRawInput] = useState("");
  const [parsed, setParsed] = useState({
    name: "",
    street1: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });
  const [response, setResponse] = useState<string | null>(null);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [nonMachinable, setNonMachinable] = useState(false);
  const [weightLb, setWeightLb] = useState(0);
  const [weightOz, setWeightOz] = useState(0);

  useEffect(() => {
    const loadUserSettings = async () => {
      if (!user) return;
      const settings = await fetchUserSettings(user.uid);
      console.log("📦 Loaded user settings:", settings); // helpful debug
      setPackages(settings?.packageTypes || []);
    };
    loadUserSettings();
  }, [user]);

  const parseAddress = () => {
    const lines = rawInput.trim().split("\n");
    if (lines.length < 3) return;

    const name = lines[0].trim();
    const street1 = lines[1].trim();
    const cityStateZipCountry = lines[2].trim();

    const cityStateZipMatch = cityStateZipCountry.match(
      /^(.*),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/
    );
    const country = lines[3]?.trim() || "US";

    if (!cityStateZipMatch) return;

    setParsed({
      name,
      street1,
      city: cityStateZipMatch[1],
      state: cityStateZipMatch[2],
      zip: cityStateZipMatch[3],
      country,
    });
  };

  const isEnvelope = !selectedPackage;

  const generateLabel = async () => {
    if (!user) {
      setResponse("You must be logged in to generate labels.");
      return;
    }

    setLoading(true);
    setResponse(null);
    setLabelUrl(null);

    try {
      const token = await user.getIdToken();

      // Build the package payload: if a custom package is selected and weight inputs are provided, merge weight
      const packagePayload = selectedPackage
        ? {
            ...selectedPackage,
            weight:
              weightLb * 16 + weightOz > 0
                ? weightLb * 16 + weightOz
                : selectedPackage.weight,
          }
        : undefined;

      const res = await fetch("/api/labels/single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customAddress: parsed,
          useEnvelope: true,
          selectedPackage: packagePayload || undefined,
          nonMachinable,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Label generation failed");

      setResponse("Label generated successfully.");
      setLabelUrl(data.labelUrl);
    } catch (err: any) {
      setResponse(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-lg mx-auto py-8 px-4">
        {/* Address paste area */}
        <div className="mb-5">
          <label style={labelStyle}>Paste Address</label>
          <textarea
            rows={4}
            className={focusClass}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder={`Paste address here\nExample:\nMichael Mahacek\n1446 ELKGROVE CIR APT 1\nVENICE, CA 90291-3103\nUS`}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
          />
          <button
            onClick={parseAddress}
            className={`mt-2 px-4 py-1.5 rounded text-sm font-medium ${focusClass}`}
            style={{
              background: "var(--sidebar)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Parse Address
          </button>
        </div>

        {/* Parsed address fields */}
        <div className="grid grid-cols-1 gap-3 mb-5">
          <div>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              className={focusClass}
              style={inputStyle}
              value={parsed.name}
              onChange={(e) => setParsed({ ...parsed, name: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Street</label>
            <input
              type="text"
              className={focusClass}
              style={inputStyle}
              value={parsed.street1}
              onChange={(e) =>
                setParsed({ ...parsed, street1: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>City</label>
              <input
                type="text"
                className={focusClass}
                style={inputStyle}
                value={parsed.city}
                onChange={(e) => setParsed({ ...parsed, city: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input
                type="text"
                className={focusClass}
                style={inputStyle}
                value={parsed.state}
                onChange={(e) =>
                  setParsed({ ...parsed, state: e.target.value })
                }
              />
            </div>
            <div>
              <label style={labelStyle}>ZIP</label>
              <input
                type="text"
                className={focusClass}
                style={inputStyle}
                value={parsed.zip}
                onChange={(e) => setParsed({ ...parsed, zip: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input
              type="text"
              className={focusClass}
              style={inputStyle}
              value={parsed.country}
              onChange={(e) =>
                setParsed({ ...parsed, country: e.target.value })
              }
            />
          </div>
        </div>

        {/* Package selector */}
        <div className="mb-5">
          <label style={labelStyle}>Package Type</label>
          <select
            className={focusClass}
            style={inputStyle}
            onChange={(e) => {
              const selected = packages.find((p) => p.name === e.target.value);
              setSelectedPackage(selected || null);
              if (!selected) {
                setWeightLb(0);
                setWeightOz(0);
              }
            }}
            value={selectedPackage?.name || ""}
          >
            <option value="">Envelope</option>
            {packages.map((pkg) => (
              <option key={pkg.name} value={pkg.name}>
                {pkg.name}
              </option>
            ))}
          </select>
        </div>

        {/* Weight inputs (shown when non-envelope package selected) */}
        {!isEnvelope && (
          <div className="mb-5">
            <label style={labelStyle}>Weight</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className={`w-20 ${focusClass}`}
                style={{
                  ...inputStyle,
                  width: "70px",
                  border: "1.5px solid var(--active-color)",
                }}
                value={weightLb}
                onChange={(e) => setWeightLb(Number(e.target.value))}
              />
              <span
                style={{ fontSize: "13px", color: "var(--muted-foreground)" }}
              >
                lb
              </span>
              <span style={{ color: "var(--muted-foreground)" }}>/</span>
              <input
                type="number"
                min={0}
                max={15}
                className={`w-20 ${focusClass}`}
                style={{
                  ...inputStyle,
                  width: "70px",
                  border: "1.5px solid var(--active-color)",
                }}
                value={weightOz}
                onChange={(e) => setWeightOz(Number(e.target.value))}
              />
              <span
                style={{ fontSize: "13px", color: "var(--muted-foreground)" }}
              >
                oz
              </span>
            </div>
          </div>
        )}

        {/* Non-machinable checkbox */}
        <div className="mb-6">
          <label
            className="flex items-center gap-2 cursor-pointer"
            style={{ fontSize: "13px", color: "var(--muted-foreground)" }}
          >
            <input
              type="checkbox"
              checked={nonMachinable}
              onChange={() => setNonMachinable(!nonMachinable)}
              className="accent-[var(--active-color)]"
            />
            <span style={{ fontWeight: 600 }}>Non-Machinable</span>
          </label>
        </div>

        {/* Generate button */}
        <button
          onClick={generateLabel}
          disabled={loading}
          className={`w-full py-2.5 rounded font-semibold text-sm transition-opacity ${focusClass}`}
          style={{
            background: "var(--primary-color)",
            color: "var(--primary-foreground, #fff)",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Generating..." : "Generate Label"}
        </button>

        {/* Response */}
        {response && (
          <p
            className="mt-4 text-sm font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            {response}
          </p>
        )}

        {/* Label actions */}
        {labelUrl && (
          <div className="mt-4 flex gap-3">
            <a
              href={labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: "var(--active-color)",
                color: "#fff",
                borderRadius: "6px",
              }}
            >
              View Label PDF
            </a>
            <a
              href="/dashboard/batch/single-labels"
              className="px-4 py-2 rounded text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: "var(--primary-color)",
                color: "var(--primary-foreground, #fff)",
                borderRadius: "6px",
              }}
            >
              Go to Single Labels Batch
            </a>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
