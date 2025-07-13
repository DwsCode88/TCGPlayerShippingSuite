"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase";
import { fetchUserSettings } from "@/lib/userSettings";
import SidebarLayout from "@/components/SidebarLayout";

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

  const generateLabel = async () => {
    if (!user) {
      setResponse("❌ You must be logged in to generate labels.");
      return;
    }

    setLoading(true);
    setResponse(null);
    setLabelUrl(null);

    try {
      const res = await fetch("/api/single-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            customAddress: parsed,
            useEnvelope: true,
            userId: user.uid,
            selectedPackage,
            nonMachinable,
          },
        ]),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Label generation failed");

      setResponse("✅ Label generated successfully.");
      setLabelUrl(data.labelUrl);
    } catch (err: any) {
      setResponse("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-xl mx-auto mt-10 px-4">
        <h1 className="text-2xl font-bold mb-4 text-white">
          Single Label Generator
        </h1>

        <textarea
          rows={4}
          className="w-full p-2 border border-gray-700 rounded bg-gray-800 text-white"
          placeholder={`Paste address here\nExample:\nMichael Mahacek\n1446 ELKGROVE CIR APT 1\nVENICE, CA 90291-3103\nUS`}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
        />

        <button
          onClick={parseAddress}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Parse Address
        </button>

        <div className="mt-6 space-y-2 text-white">
          <div>
            <strong>Name:</strong> {parsed.name}
          </div>
          <div>
            <strong>Street:</strong> {parsed.street1}
          </div>
          <div>
            <strong>City:</strong> {parsed.city}
          </div>
          <div>
            <strong>State:</strong> {parsed.state}
          </div>
          <div>
            <strong>ZIP:</strong> {parsed.zip}
          </div>
          <div>
            <strong>Country:</strong> {parsed.country}
          </div>
        </div>

        <div className="mt-6 text-white">
          <label className="block mb-2">📦 Package Preset</label>
          <select
            onChange={(e) => {
              const selected = packages.find((p) => p.name === e.target.value);
              setSelectedPackage(selected || null);
            }}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
          >
            <option value="">-- Default (Letter) --</option>
            {packages.map((pkg) => (
              <option key={pkg.name} value={pkg.name}>
                {pkg.name}
              </option>
            ))}
          </select>

          <label className="mt-4 block">
            <input
              type="checkbox"
              className="mr-2"
              checked={nonMachinable}
              onChange={() => setNonMachinable(!nonMachinable)}
            />
            Non-Machinable
          </label>
        </div>

        <button
          onClick={generateLabel}
          disabled={loading}
          className="mt-6 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
        >
          {loading ? "Generating..." : "Generate Label"}
        </button>

        {response && <p className="mt-4 text-white">{response}</p>}

        {labelUrl && (
          <div className="mt-4 flex gap-4">
            <a
              href={labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded"
            >
              📄 View Label PDF
            </a>
            <a
              href="/dashboard/batch/single-labels"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
            >
              📂 Go to Single Labels Batch
            </a>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
