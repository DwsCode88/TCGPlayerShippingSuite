"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import Link from "next/link";
import { debounce } from "lodash";

type Order = {
  orderNumber: string;
  toName: string;
  trackingCode: string;
  trackingUrl?: string;
  labelUrl: string;
  labelCost: number;
  envelopeCost: number;
  shieldCost: number;
  pennyCost: number;
  loaderCost: number;
  totalCost: number;
  shippingShield: boolean;
  useEnvelope: boolean;
  notes?: string;
};

export default function BatchSummaryPage() {
  const { batchId } = useParams() as { batchId: string };

  const [orders, setOrders] = useState<Order[]>([]);
  const [batchName, setBatchName] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [createdDate, setCreatedDate] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const batchSnap = await getDoc(doc(db, "batches", batchId));
      const orderSnap = await getDocs(
        query(collection(db, "orders"), where("batchId", "==", batchId))
      );

      const parsed: Order[] = [];
      orderSnap.forEach((doc) => parsed.push(doc.data() as Order));
      setOrders(parsed);

      if (batchSnap.exists()) {
        const meta = batchSnap.data();
        setBatchName(meta.batchName || "");
        setBatchNotes(meta.notes || "");

        // ✅ Fix invalid date
        const timestamp = meta.createdAt?.toDate?.();
        setCreatedDate(timestamp ? timestamp.toLocaleString() : "Unknown");

        setArchived(meta.archived || false);
      }

      setLoading(false);
    };

    fetchData();
  }, [batchId]);

  const sum = (field: keyof Order) =>
    orders
      .reduce(
        (acc, o) =>
          acc + (typeof o[field] === "number" ? (o[field] as number) : 0),
        0
      )
      .toFixed(2);

  const debouncedSave = debounce(async (text: string) => {
    const batchRef = doc(db, "batches", batchId);
    await updateDoc(batchRef, { notes: text });
  }, 1000);

  const handleDownloadCSV = () => {
    const csv = [
      ["Order #", "Tracking #", "Carrier"],
      ...orders.map((o) => [o.orderNumber, o.trackingCode, "USPS"]),
    ]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const filename = `Tcgtracking_${now
      .toLocaleDateString()
      .replace(/\//g, "-")}_${now.toLocaleTimeString().replace(/:/g, "-")}`;

    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  const downloadByType = async (urls: string[], filename: string) => {
    if (!urls.length) return alert("No labels found.");
    const res = await fetch("/api/labels/merge", {
      method: "POST",
      body: JSON.stringify(urls),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return alert("Failed to generate PDF");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const envelopeOrders = orders.filter((o) => o.useEnvelope);
  const groundOrders = orders.filter((o) => !o.useEnvelope);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-white">
      <div className="mb-8 flex justify-between items-start flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold mb-1">📦 Batch Summary</h1>
          <p className="text-gray-400">
            Batch: <strong>{batchName}</strong>
          </p>
          <p className="text-sm text-gray-500">Created: {createdDate}</p>
          {archived && (
            <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 rounded">
              ARCHIVED
            </span>
          )}
        </div>
        <Link
          href="/dashboard/history"
          className="text-blue-400 hover:underline text-sm mt-1"
        >
          ← Back to History
        </Link>
      </div>

      <div className="bg-[#1f1f1f] border border-gray-700 rounded-lg p-4 mb-8 shadow-sm">
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          📝 Batch Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={batchNotes}
          onChange={(e) => {
            setBatchNotes(e.target.value);
            debouncedSave(e.target.value);
          }}
          className="w-full border border-gray-700 bg-black p-2 rounded text-sm text-white placeholder:text-gray-500"
          placeholder="Add notes about this batch (auto-saved)"
        />
        <p className="text-xs text-gray-500 mt-1">
          🧠 Notes auto-save while typing…
        </p>
      </div>

      {loading ? (
        <p className="text-center text-gray-400">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-center text-gray-400">
          No orders found for this batch.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <button
              onClick={handleDownloadCSV}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              📄 Download CSV
            </button>
            <button
              onClick={() =>
                downloadByType(
                  orders.map((o) => o.labelUrl),
                  "batch-all-labels.pdf"
                )
              }
              className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm"
            >
              🖨 All Labels
            </button>
            <button
              onClick={() =>
                downloadByType(
                  envelopeOrders.map((o) => o.labelUrl),
                  "batch-envelope-labels.pdf"
                )
              }
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
            >
              ✉️ Envelope Labels
            </button>
            <button
              onClick={() =>
                downloadByType(
                  groundOrders.map((o) => o.labelUrl),
                  "batch-ground-labels.pdf"
                )
              }
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
            >
              🚚 Ground Advantage
            </button>
          </div>

          <div className="overflow-x-auto bg-[#1a1a1a] border border-gray-800 shadow rounded-lg">
            <table className="min-w-full text-sm text-left text-white">
              <thead className="bg-[#2a2a2a] text-xs text-gray-400 sticky top-0">
                <tr>
                  <th className="p-3">Order #</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Tracking</th>
                  <th className="p-3">💧 Sleeve</th>
                  <th className="p-3">📎 Loader</th>
                  <th className="p-3">✉️ Envelope</th>
                  <th className="p-3">🛡 Shield</th>
                  <th className="p-3">💰 Postage</th>
                  <th className="p-3">🧾 Total</th>
                  <th className="p-3">📝 Notes</th>
                  <th className="p-3">Label</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-800 hover:bg-[#2a2a2a]"
                  >
                    <td className="p-3">{o.orderNumber}</td>
                    <td className="p-3">{o.toName}</td>
                    <td className="p-3 text-xs">
                      {o.trackingCode}
                      {o.trackingUrl && (
                        <div>
                          <a
                            href={o.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-blue-400 hover:underline text-xs"
                          >
                            🔗 Track
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      ${o.pennyCost?.toFixed(2) || "0.00"}
                    </td>
                    <td className="p-3">
                      ${o.loaderCost?.toFixed(2) || "0.00"}
                    </td>
                    <td className="p-3">
                      ${o.envelopeCost?.toFixed(2) || "0.00"}
                    </td>
                    <td className="p-3">
                      ${o.shieldCost?.toFixed(2) || "0.00"}
                    </td>
                    <td className="p-3">
                      ${o.labelCost?.toFixed(2) || "0.00"}
                    </td>
                    <td className="p-3 font-semibold">
                      ${o.totalCost?.toFixed(2) || "0.00"}
                    </td>
                    <td className="p-3 text-xs text-gray-400">
                      {o.notes || ""}
                    </td>
                    <td className="p-3">
                      <a
                        href={o.labelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-blue-400 hover:underline text-sm"
                      >
                        🔍 View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#2a2a2a] text-sm text-white font-semibold">
                <tr>
                  <td colSpan={3} className="p-3">
                    Totals
                  </td>
                  <td className="p-3">${sum("pennyCost")}</td>
                  <td className="p-3">${sum("loaderCost")}</td>
                  <td className="p-3">${sum("envelopeCost")}</td>
                  <td className="p-3">${sum("shieldCost")}</td>
                  <td className="p-3">${sum("labelCost")}</td>
                  <td className="p-3">${sum("totalCost")}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
