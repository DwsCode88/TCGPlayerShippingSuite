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
import SidebarLayout from "@/components/SidebarLayout";

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
        setCreatedDate(
          meta.createdAt ? new Date(meta.createdAt).toLocaleString() : ""
        );
        setArchived(meta.archived || false);
      }

      setLoading(false);
    };

    fetchData();
  }, [batchId]);

  const sum = (field: keyof Order) =>
    orders
      .reduce((acc, o) => {
        const value = o[field];
        return acc + (typeof value === "number" ? value : 0);
      }, 0)
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
    const dateStr = now
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
      .replace(/ /g, "-");

    const timeStr = now
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(/:/g, "-");

    const a = document.createElement("a");
    a.href = url;
    a.download = `Tcgtracking_${dateStr}_${timeStr}.csv`;
    a.click();
  };

  const downloadByType = async (labelUrls: string[], filename: string) => {
    if (!labelUrls.length) {
      alert("No labels found for this type.");
      return;
    }

    const res = await fetch("/api/labels/merge", {
      method: "POST",
      body: JSON.stringify(labelUrls),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      alert("Failed to generate PDF");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const envelopeOrders = orders.filter((o) => o.useEnvelope === true);
  const groundOrders = orders.filter((o) => o.useEnvelope === false);

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6 flex justify-between items-start flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              📦 Batch Summary
            </h1>
            <p className="text-gray-600">
              Batch: <strong>{batchName}</strong>
            </p>
            <p className="text-sm text-gray-500">Created: {createdDate}</p>
            {archived && (
              <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded">
                ARCHIVED
              </span>
            )}
          </div>
          <Link
            href="/dashboard/history"
            className="text-blue-600 hover:underline text-sm mt-1"
          >
            ← Back to History
          </Link>
        </div>

        <div className="mb-6">
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700"
          >
            📝 Batch Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={batchNotes}
            onChange={(e) => {
              const val = e.target.value;
              setBatchNotes(val);
              debouncedSave(val);
            }}
            className="mt-1 w-full border p-2 rounded text-sm"
            placeholder="Add notes about this batch (auto-saved)"
          />
          <p className="text-xs text-gray-500 mt-1">
            🧠 Notes auto-save while typing...
          </p>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-500">
            No orders found for this batch.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <button
                onClick={handleDownloadCSV}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                📄 Download TCGplayer CSV
              </button>
              <button
                onClick={() =>
                  downloadByType(
                    orders.map((o) => o.labelUrl),
                    "batch-all-labels.pdf"
                  )
                }
                className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 text-sm"
              >
                🖨 Download All Labels (PDF)
              </button>
              <button
                onClick={() =>
                  downloadByType(
                    envelopeOrders.map((o) => o.labelUrl),
                    "batch-envelope-labels.pdf"
                  )
                }
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm"
              >
                ✉️ Download Envelope Labels
              </button>
              <button
                onClick={() =>
                  downloadByType(
                    groundOrders.map((o) => o.labelUrl),
                    "batch-ground-labels.pdf"
                  )
                }
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
              >
                🚚 Download Ground Advantage Labels
              </button>
            </div>

            <div className="overflow-x-auto bg-white shadow rounded-lg">
              <table className="min-w-full text-sm text-gray-800">
                <thead className="bg-gray-100 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="p-3 text-left">Order #</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Tracking</th>
                    <th className="p-3 text-left">💧 Sleeve</th>
                    <th className="p-3 text-left">📎 Loader</th>
                    <th className="p-3 text-left">✉️ Envelope</th>
                    <th className="p-3 text-left">🛡 Shield</th>
                    <th className="p-3 text-left">💰 Postage</th>
                    <th className="p-3 text-left">🧾 Total</th>
                    <th className="p-3 text-left">📝 Notes</th>
                    <th className="p-3 text-left">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-3">{o.orderNumber}</td>
                      <td className="p-3">{o.toName}</td>
                      <td className="p-3 text-xs text-gray-600">
                        {o.trackingCode}
                        {o.trackingUrl && (
                          <div>
                            <a
                              href={o.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 underline"
                            >
                              Track Package
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
                      <td className="p-3 text-xs text-gray-600">
                        {o.notes || ""}
                      </td>
                      <td className="p-3">
                        <a
                          href={o.labelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
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
    </SidebarLayout>
  );
}
